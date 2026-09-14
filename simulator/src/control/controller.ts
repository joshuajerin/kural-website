import {
  JOINT_NAMES,
  mapJoints,
  type ActuatorTargets,
  type CommandAcceptance,
  type JointName,
  type RobotControlConfig,
  type RobotState,
  type SemanticCommand,
} from '../types'
import { GESTURES, gestureSegmentDuration, type GestureDefinition } from './gestures'
import { calculateOmniWheelTargets, type ChassisVelocity } from './kinematics'
import { clamp, finite, moveToward, smoothstep } from './math'
import type { RecordingSink } from './recording'

interface TimedValue<T> {
  value: T
  expiresAtMs: number
}

interface GestureRun {
  definition: GestureDefinition
  startedAtMs: number
  startPose: Record<JointName, number>
}

const ZERO_DRIVE: ChassisVelocity = { vx: 0, vy: 0, yawRate: 0 }

function stateJointPosition(state: RobotState, joint: JointName, fallback: number): number {
  return state.joints[joint].value ?? fallback
}

function copyJointPositions(
  state: RobotState,
  fallback: Record<JointName, number>,
): Record<JointName, number> {
  return mapJoints((joint) => stateJointPosition(state, joint, fallback[joint]))
}

function commandHasFiniteValues(command: SemanticCommand): boolean {
  switch (command.kind) {
    case 'drive':
      return finite(command.vx, command.vy, command.yawRate)
    case 'moveLift':
    case 'jogJoint':
      return finite(command.velocity)
    case 'setGripper':
      return finite(command.position)
    case 'setJointTargets':
      return Object.values(command.targets).every((value) => value === undefined || finite(value))
    default:
      return true
  }
}

export class KuralController {
  private lastSequence = -1
  private drive: TimedValue<ChassisVelocity> | null = null
  private liftVelocity: TimedValue<number> | null = null
  private jointJog: TimedValue<{ joint: JointName; velocity: number }> | null = null
  private gesture: GestureRun | null = null
  private jointTargets: Record<JointName, number> | null = null
  private jointVelocities = mapJoints(() => 0)
  private liftTarget: number | null = null
  private wheelVelocities: Record<string, number>
  private stopped = true
  private recorder: RecordingSink | null = null

  constructor(
    readonly sessionId: string,
    readonly config: RobotControlConfig,
  ) {
    if (config.wheels.length !== 3) throw new Error('Kural requires exactly three drive wheels')
    this.wheelVelocities = Object.fromEntries(config.wheels.map((wheel) => [wheel.name, 0]))
  }

  setRecorder(recorder: RecordingSink | null): void {
    this.recorder = recorder
  }

  accept(command: SemanticCommand, nowMs = command.issuedAtMs): CommandAcceptance {
    if (command.sessionId !== this.sessionId) return { accepted: false, reason: 'wrong-session' }
    if (command.configRevision !== this.config.revision) {
      return { accepted: false, reason: 'wrong-config' }
    }
    if (command.sequence <= this.lastSequence) return { accepted: false, reason: 'stale-sequence' }
    // A stop remains safe and useful even if transport delay outlives its TTL.
    if (command.kind !== 'stop' && command.expiresAtMs <= nowMs) {
      return { accepted: false, reason: 'expired' }
    }
    if (!commandHasFiniteValues(command)) return { accepted: false, reason: 'invalid-value' }
    if (command.kind === 'playGesture' && this.gesture) {
      return { accepted: false, reason: 'gesture-active' }
    }

    this.lastSequence = command.sequence
    switch (command.kind) {
      case 'drive':
        this.cancelGestureForManualMotion(command.vx, command.vy, command.yawRate)
        this.drive = {
          value: { vx: command.vx, vy: command.vy, yawRate: command.yawRate },
          expiresAtMs: command.expiresAtMs,
        }
        this.stopped = false
        break
      case 'moveLift':
        this.cancelGestureForManualMotion(command.velocity)
        this.liftVelocity = {
          value: clamp(command.velocity, -this.config.liftMaxVelocity, this.config.liftMaxVelocity),
          expiresAtMs: command.expiresAtMs,
        }
        this.stopped = false
        break
      case 'jogJoint':
        this.cancelGestureForManualMotion(command.velocity)
        this.jointJog = {
          value: {
            joint: command.joint,
            velocity: clamp(
              command.velocity,
              -this.config.joints[command.joint].maxVelocity,
              this.config.joints[command.joint].maxVelocity,
            ),
          },
          expiresAtMs: command.expiresAtMs,
        }
        this.stopped = false
        break
      case 'setJointTargets':
        this.gesture = null
        this.ensureJointTargets()
        for (const [joint, position] of Object.entries(command.targets) as Array<
          [JointName, number]
        >) {
          const limit = this.config.joints[joint]
          this.jointTargets![joint] = clamp(position, limit.min, limit.max)
        }
        this.stopped = false
        break
      case 'setGripper': {
        this.gesture = null
        this.ensureJointTargets()
        const limit = this.config.joints.gripper
        this.jointTargets!.gripper = clamp(command.position, limit.min, limit.max)
        this.stopped = false
        break
      }
      case 'playGesture':
        this.drive = null
        this.liftVelocity = null
        this.jointJog = null
        this.gesture = {
          definition: GESTURES[command.gesture],
          startedAtMs: nowMs,
          startPose: this.jointTargets
            ? { ...this.jointTargets }
            : { ...this.config.neutralJoints },
        }
        this.stopped = false
        break
      case 'stop':
        this.requestStop()
        break
      case 'resetSimulation':
        this.requestStop()
        this.jointTargets = { ...this.config.neutralJoints }
        this.jointVelocities = mapJoints(() => 0)
        this.liftTarget = this.config.liftMin
        this.wheelVelocities = Object.fromEntries(
          this.config.wheels.map((wheel) => [wheel.name, 0]),
        )
        break
    }
    this.recorder?.recordCommand(command)
    return { accepted: true }
  }

  update(nowMs: number, deltaSeconds: number, state: RobotState): ActuatorTargets {
    if (!finite(nowMs, deltaSeconds) || deltaSeconds < 0) {
      throw new Error('Controller update requires finite, non-negative timing')
    }
    this.initializeTargets(state)
    this.expireContinuousCommands(nowMs)

    const drive = this.stopped || this.gesture ? ZERO_DRIVE : this.drive?.value ?? ZERO_DRIVE
    const desiredWheels = calculateOmniWheelTargets(drive, this.config).wheelVelocities
    const maxWheelDelta = this.config.maxWheelAcceleration * deltaSeconds
    for (const wheel of this.config.wheels) {
      this.wheelVelocities[wheel.name] = moveToward(
        this.wheelVelocities[wheel.name],
        desiredWheels[wheel.name],
        maxWheelDelta,
      )
    }

    const requestedLiftVelocity =
      this.stopped || this.gesture ? 0 : this.liftVelocity?.value ?? 0
    this.liftTarget = clamp(
      this.liftTarget! + requestedLiftVelocity * deltaSeconds,
      this.config.liftMin,
      this.config.liftMax,
    )

    let desiredJoints = { ...this.jointTargets! }
    if (this.gesture) desiredJoints = this.sampleGesture(nowMs, this.gesture)
    if (!this.stopped && !this.gesture && this.jointJog) {
      const { joint, velocity } = this.jointJog.value
      const limit = this.config.joints[joint]
      desiredJoints[joint] = clamp(
        desiredJoints[joint] + velocity * deltaSeconds,
        limit.min,
        limit.max,
      )
    }

    for (const joint of JOINT_NAMES) {
      const limit = this.config.joints[joint]
      const current = this.jointTargets![joint]
      const difference = desiredJoints[joint] - current
      const requestedVelocity =
        deltaSeconds > 0
          ? clamp(difference / deltaSeconds, -limit.maxVelocity, limit.maxVelocity)
          : 0
      const velocity = moveToward(
        this.jointVelocities[joint],
        requestedVelocity,
        limit.maxAcceleration * deltaSeconds,
      )
      const step = velocity * deltaSeconds
      this.jointTargets![joint] = clamp(
        Math.abs(step) >= Math.abs(difference) ? desiredJoints[joint] : current + step,
        limit.min,
        limit.max,
      )
      this.jointVelocities[joint] = velocity
    }

    const targets: ActuatorTargets = {
      timestampMs: nowMs,
      wheelVelocities: { ...this.wheelVelocities },
      liftPosition: this.liftTarget,
      liftVelocity: requestedLiftVelocity,
      jointPositions: { ...this.jointTargets! },
      jointVelocities: { ...this.jointVelocities },
      activeGesture: this.gesture?.definition.id ?? null,
      stopped: this.stopped,
    }
    this.recorder?.recordFrame(state, targets)
    return targets
  }

  get activeGesture() {
    return this.gesture?.definition.id ?? null
  }

  private ensureJointTargets(): void {
    if (!this.jointTargets) this.jointTargets = { ...this.config.neutralJoints }
  }

  private initializeTargets(state: RobotState): void {
    if (!this.jointTargets) this.jointTargets = copyJointPositions(state, this.config.neutralJoints)
    if (this.liftTarget === null) {
      this.liftTarget = clamp(
        state.lift.value ?? this.config.liftMin,
        this.config.liftMin,
        this.config.liftMax,
      )
    }
  }

  private cancelGestureForManualMotion(...values: number[]): void {
    if (values.some((value) => value !== 0)) this.gesture = null
  }

  private requestStop(): void {
    this.drive = null
    this.liftVelocity = null
    this.jointJog = null
    this.gesture = null
    this.stopped = true
  }

  private expireContinuousCommands(nowMs: number): void {
    const expired =
      (this.drive !== null && nowMs >= this.drive.expiresAtMs) ||
      (this.liftVelocity !== null && nowMs >= this.liftVelocity.expiresAtMs) ||
      (this.jointJog !== null && nowMs >= this.jointJog.expiresAtMs)
    if (expired) this.requestStop()
  }

  private sampleGesture(nowMs: number, run: GestureRun): Record<JointName, number> {
    const elapsedMs = Math.max(0, nowMs - run.startedAtMs)
    let segmentStartMs = 0
    let segmentStart = { ...run.startPose }

    for (const frame of run.definition.keyframes) {
      const durationMs = gestureSegmentDuration(segmentStart, frame, this.config)
      const segmentEndMs = segmentStartMs + durationMs
      const segmentEnd = { ...segmentStart, ...frame.targets }
      if (elapsedMs <= segmentEndMs) {
        const progress = durationMs <= 0 ? 1 : (elapsedMs - segmentStartMs) / durationMs
        const blend = smoothstep(progress)
        return mapJoints((joint) => {
          const value = segmentStart[joint] + (segmentEnd[joint] - segmentStart[joint]) * blend
          const limit = this.config.joints[joint]
          return clamp(value, limit.min, limit.max)
        })
      }
      segmentStart = segmentEnd
      segmentStartMs = segmentEndMs
    }

    this.gesture = null
    return segmentStart
  }
}
