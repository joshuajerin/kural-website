/// <reference lib="webworker" />

import loadMujoco, { type MainModule, type MjData, type MjModel } from '@mujoco/mujoco'
import mujocoWasmUrl from '@mujoco/mujoco/mujoco.wasm?url'
import { calculateOmniWheelTargets, DEFAULT_CONTROL_CONFIG, GESTURES } from '../control'
import { gestureSegmentDuration } from '../control/gestures'
import { HeadingController, quaternionYaw, SIMULATION_WHEEL_ACTUATORS } from '../control/heading'
import { JOINT_NAMES, type ActuatorTargets, type GestureId, type JointName, type RobotState, type SemanticCommand } from '../types'
import type {
  BodyTransform,
  MainToWorkerMessage,
  PerformanceSample,
  WorkerToMainMessage,
} from './protocol'

const PHYSICS_STEP_SECONDS = 0.002
const CONTROL_INTERVAL_MS = 20
const SNAPSHOT_INTERVAL_MS = 1000 / 30
const MAX_ACCUMULATOR_MS = 50
const workerScope = self as unknown as DedicatedWorkerGlobalScope

let mujoco: MainModule | null = null
let model: MjModel | null = null
let data: MjData | null = null
let timer: number | null = null
let paused = false
let lastLoopMs = performance.now()
let lastControlMs = 0
let lastSnapshotMs = 0
let lastContinuousAtMs = 0
let accumulatorMs = 0
let droppedTimeMs = 0
let stepCostMs = 0
let stepCounter = 0
let lastRateSampleMs = performance.now()
let measuredPhysicsHz = 0
let measuredSnapshotHz = 0
let snapshotCounter = 0
let sequence = 0
let bodyNames: string[] = []
let actuatorNames: string[] = []
let actuatorIndexes = new Map<string, number>()
const headingController = new HeadingController()
let commandSession: string | null = null
let commandSequence = -1

const desired = {
  drive: { vx: 0, vy: 0, yawRate: 0 },
  liftVelocity: 0,
  jointVelocity: Object.fromEntries(JOINT_NAMES.map((name) => [name, 0])) as Record<JointName, number>,
  liftTarget: 0.43,
  jointTargets: { ...DEFAULT_CONTROL_CONFIG.neutralJoints },
  activeGesture: null as GestureId | null,
  gestureStartedAt: 0,
  gestureStart: { ...DEFAULT_CONTROL_CONFIG.neutralJoints },
}
const wheelControlState = Object.fromEntries(
  DEFAULT_CONTROL_CONFIG.wheels.map((wheel) => [wheel.name, 0]),
) as Record<string, number>

function post(message: WorkerToMainMessage) {
  workerScope.postMessage(message)
}

function readScalar(value: unknown, index = 0): number {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object') {
    const candidate = value as { get?: (at: number) => number; [key: number]: number }
    if (typeof candidate.get === 'function') return Number(candidate.get(index))
    return Number(candidate[index])
  }
  return 0
}

function readVector(value: unknown, length: number): number[] {
  return Array.from({ length }, (_, index) => readScalar(value, index))
}

async function writeModelFiles(module: MainModule, modelUrl: string): Promise<string> {
  const response = await fetch(modelUrl)
  if (!response.ok) throw new Error(`Model request failed (${response.status})`)
  const xml = await response.text()
  const root = '/kural-model'
  module.FS.mkdirTree(root, 0o777)
  module.FS.writeFile(`${root}/kural.xml`, xml)

  const references = [...xml.matchAll(/\bfile=["']([^"']+)["']/g)].map((match) => match[1])
  for (const reference of new Set(references)) {
    if (/^(?:data:|https?:)/.test(reference)) continue
    const assetUrl = new URL(reference, new URL(modelUrl, workerScope.location.href)).href
    const assetResponse = await fetch(assetUrl)
    if (!assetResponse.ok) throw new Error(`Asset request failed: ${reference} (${assetResponse.status})`)
    const virtualPath = `${root}/${reference.replace(/^\.\//, '')}`
    module.FS.mkdirTree(virtualPath.slice(0, virtualPath.lastIndexOf('/')), 0o777)
    module.FS.writeFile(virtualPath, new Uint8Array(await assetResponse.arrayBuffer()))
  }
  return `${root}/kural.xml`
}

function discoverModel() {
  if (!model) return
  bodyNames = []
  actuatorNames = []
  actuatorIndexes = new Map()
  for (let index = 0; index < model.nbody; index += 1) {
    const body = model.body(index)
    try {
      bodyNames.push(body.name || `body_${index}`)
    } finally {
      body.delete()
    }
  }
  for (let index = 0; index < model.nu; index += 1) {
    const actuator = model.actuator(index)
    try {
      const name = actuator.name || `actuator_${index}`
      actuatorNames.push(name)
      actuatorIndexes.set(name, index)
    } finally {
      actuator.delete()
    }
  }
}

function resetTargets() {
  headingController.reset()
  desired.drive = { vx: 0, vy: 0, yawRate: 0 }
  desired.liftVelocity = 0
  for (const joint of JOINT_NAMES) desired.jointVelocity[joint] = 0
  desired.liftTarget = 0.43
  desired.jointTargets = { ...DEFAULT_CONTROL_CONFIG.neutralJoints }
  desired.activeGesture = null
  for (const wheel of DEFAULT_CONTROL_CONFIG.wheels) wheelControlState[wheel.name] = 0
  lastContinuousAtMs = performance.now()
}

function stopTargets() {
  desired.drive = { vx: 0, vy: 0, yawRate: 0 }
  desired.liftVelocity = 0
  for (const joint of JOINT_NAMES) desired.jointVelocity[joint] = 0
  desired.activeGesture = null
}

function acceptCommand(command: SemanticCommand) {
  if (command.configRevision !== DEFAULT_CONTROL_CONFIG.revision) return
  if (command.kind !== 'stop' && Date.now() > command.expiresAtMs) return
  if (commandSession !== null && command.sessionId !== commandSession) return
  if (command.sequence <= commandSequence) return
  commandSession = command.sessionId
  commandSequence = command.sequence
  if (command.kind === 'drive') {
    desired.drive = { vx: command.vx, vy: command.vy, yawRate: command.yawRate }
    if (command.vx || command.vy || command.yawRate) desired.activeGesture = null
    lastContinuousAtMs = performance.now()
  } else if (command.kind === 'moveLift') {
    desired.liftVelocity = command.velocity
    if (command.velocity) desired.activeGesture = null
    lastContinuousAtMs = performance.now()
  } else if (command.kind === 'jogJoint') {
    for (const joint of JOINT_NAMES) desired.jointVelocity[joint] = 0
    desired.jointVelocity[command.joint] = command.velocity
    if (command.velocity) desired.activeGesture = null
    lastContinuousAtMs = performance.now()
  } else if (command.kind === 'setJointTargets') {
    for (const joint of JOINT_NAMES) {
      const value = command.targets[joint]
      if (value !== undefined) {
        const limits = DEFAULT_CONTROL_CONFIG.joints[joint]
        desired.jointTargets[joint] = Math.min(limits.max, Math.max(limits.min, value))
      }
    }
    desired.activeGesture = null
  } else if (command.kind === 'setGripper') {
    const limits = DEFAULT_CONTROL_CONFIG.joints.gripper
    desired.jointTargets.gripper = Math.min(limits.max, Math.max(limits.min, command.position))
  } else if (command.kind === 'playGesture') {
    if (desired.activeGesture) return
    desired.activeGesture = command.gesture
    desired.gestureStartedAt = performance.now()
    desired.gestureStart = { ...desired.jointTargets }
    stopTargets()
    desired.activeGesture = command.gesture
  } else if (command.kind === 'stop') {
    stopTargets()
  } else if (command.kind === 'resetSimulation') {
    resetSimulation()
  }
}

function actuatorIndex(...candidates: string[]): number | undefined {
  for (const candidate of candidates) {
    const direct = actuatorIndexes.get(candidate)
    if (direct !== undefined) return direct
    const fuzzy = actuatorNames.findIndex((name) => name.includes(candidate))
    if (fuzzy >= 0) return fuzzy
  }
  return undefined
}

function setControl(value: number, ...names: string[]) {
  if (!data) return
  const index = actuatorIndex(...names)
  if (index !== undefined) data.ctrl[index] = value
}

function setJointPosition(name: string, value: number) {
  if (!model || !data) return
  const joint = model.jnt(name)
  try {
    data.qpos[readScalar(joint.qposadr)] = value
  } finally {
    joint.delete()
  }
}

function applyAuthoredHomePose() {
  setJointPosition('lift', 0.43)
  for (const joint of JOINT_NAMES) setJointPosition(joint, DEFAULT_CONTROL_CONFIG.neutralJoints[joint])
}

function updateGesture(nowMs: number) {
  if (!desired.activeGesture) return
  const definition = GESTURES[desired.activeGesture]
  let elapsed = nowMs - desired.gestureStartedAt
  let from = { ...desired.gestureStart }
  for (const frame of definition.keyframes) {
    const durationMs = gestureSegmentDuration(from, frame, DEFAULT_CONTROL_CONFIG)
    if (elapsed <= durationMs) {
      const t = Math.min(1, Math.max(0, elapsed / durationMs))
      const smooth = t * t * (3 - 2 * t)
      for (const joint of JOINT_NAMES) {
        const target = frame.targets[joint] ?? from[joint]
        desired.jointTargets[joint] = from[joint] + (target - from[joint]) * smooth
      }
      return
    }
    elapsed -= durationMs
    from = { ...from, ...frame.targets }
  }
  desired.jointTargets = from
  desired.activeGesture = null
}

function updateControls(nowMs: number) {
  if (!data) return
  if (nowMs - lastContinuousAtMs > DEFAULT_CONTROL_CONFIG.commandTimeoutMs) {
    desired.drive = { vx: 0, vy: 0, yawRate: 0 }
    desired.liftVelocity = 0
    for (const joint of JOINT_NAMES) desired.jointVelocity[joint] = 0
  }

  updateGesture(nowMs)
  desired.liftTarget = Math.min(
    DEFAULT_CONTROL_CONFIG.liftMax,
    Math.max(DEFAULT_CONTROL_CONFIG.liftMin, desired.liftTarget + desired.liftVelocity * (CONTROL_INTERVAL_MS / 1000)),
  )
  for (const joint of JOINT_NAMES) {
    const limits = DEFAULT_CONTROL_CONFIG.joints[joint]
    desired.jointTargets[joint] = Math.min(
      limits.max,
      Math.max(limits.min, desired.jointTargets[joint] + desired.jointVelocity[joint] * (CONTROL_INTERVAL_MS / 1000)),
    )
  }

  const baseBody = data.body('chassis')
  let yaw = 0
  try { yaw = quaternionYaw(readVector(baseBody.xquat, 4)) } finally { baseBody.delete() }
  const correctedDrive = headingController.update(desired.drive, yaw, CONTROL_INTERVAL_MS / 1000)
  const wheelTargets = calculateOmniWheelTargets(correctedDrive, DEFAULT_CONTROL_CONFIG).wheelVelocities
  const maxWheelDelta = DEFAULT_CONTROL_CONFIG.maxWheelAcceleration * (CONTROL_INTERVAL_MS / 1000)
  for (const [name, target] of Object.entries(wheelTargets)) {
    const current = wheelControlState[name] ?? 0
    const value = current + Math.max(-maxWheelDelta, Math.min(maxWheelDelta, target - current))
    wheelControlState[name] = value
    setControl(value, SIMULATION_WHEEL_ACTUATORS[name] ?? `${name}_motor`)
  }
  setControl(desired.liftTarget, 'lift', 'lift_position', 'lift_actuator')
  for (const joint of JOINT_NAMES) setControl(desired.jointTargets[joint], joint, `${joint}_position`, `${joint}_actuator`)
}

function readJoint(name: JointName): { value: number | null; velocity: number | null; source: 'simulated' | 'unavailable' } {
  if (!data) return { value: null, velocity: null, source: 'unavailable' }
  try {
    const joint = data.jnt(name)
    try {
      return { value: readScalar(joint.qpos), velocity: readScalar(joint.qvel), source: 'simulated' }
    } finally {
      joint.delete()
    }
  } catch {
    return { value: null, velocity: null, source: 'unavailable' }
  }
}

function readBodies(): BodyTransform[] {
  if (!data) return []
  return bodyNames.map((name, index) => ({
    name,
    position: [data!.xpos[index * 3], data!.xpos[index * 3 + 1], data!.xpos[index * 3 + 2]],
    quaternion: [data!.xquat[index * 4], data!.xquat[index * 4 + 1], data!.xquat[index * 4 + 2], data!.xquat[index * 4 + 3]],
  }))
}

function makeRobotState(nowMs: number): RobotState {
  let basePosition: [number, number, number] = [0, 0, 0]
  let baseOrientation: [number, number, number, number] = [1, 0, 0, 0]
  const baseIndex = bodyNames.findIndex((name) => /base|chassis/i.test(name))
  if (data && baseIndex >= 0) {
    basePosition = [data.xpos[baseIndex * 3], data.xpos[baseIndex * 3 + 1], data.xpos[baseIndex * 3 + 2]]
    baseOrientation = [data.xquat[baseIndex * 4], data.xquat[baseIndex * 4 + 1], data.xquat[baseIndex * 4 + 2], data.xquat[baseIndex * 4 + 3]]
  }
  let lift = { value: null as number | null, velocity: null as number | null, source: 'unavailable' as 'simulated' | 'unavailable' }
  if (data) {
    try {
      const joint = data.jnt('lift')
      try {
        lift = { value: readScalar(joint.qpos), velocity: readScalar(joint.qvel), source: 'simulated' }
      } finally {
        joint.delete()
      }
    } catch { /* optional model joint */ }
  }
  return {
    timestampMs: nowMs,
    sequence: sequence++,
    modelRevision: DEFAULT_CONTROL_CONFIG.modelRevision,
    configRevision: DEFAULT_CONTROL_CONFIG.revision,
    base: { position: basePosition, orientation: baseOrientation, velocity: [0, 0, 0] },
    lift,
    joints: Object.fromEntries(JOINT_NAMES.map((name) => [name, readJoint(name)])) as RobotState['joints'],
    paused,
    fault: null,
  }
}

function makeActuatorTargets(nowMs: number): ActuatorTargets {
  const stopped = Object.values(wheelControlState).every((value) => Math.abs(value) < 1e-6)
    && desired.liftVelocity === 0
    && JOINT_NAMES.every((joint) => desired.jointVelocity[joint] === 0)
    && desired.activeGesture === null
  return {
    timestampMs: nowMs,
    wheelVelocities: { ...wheelControlState },
    liftPosition: desired.liftTarget,
    liftVelocity: desired.liftVelocity,
    jointPositions: { ...desired.jointTargets },
    jointVelocities: { ...desired.jointVelocity },
    activeGesture: desired.activeGesture,
    stopped,
  }
}

function loop() {
  if (!mujoco || !model || !data) return
  const nowMs = performance.now()
  const elapsedMs = Math.max(0, nowMs - lastLoopMs)
  lastLoopMs = nowMs

  if (!paused) {
    accumulatorMs += elapsedMs
    if (accumulatorMs > MAX_ACCUMULATOR_MS) {
      droppedTimeMs += accumulatorMs - MAX_ACCUMULATOR_MS
      accumulatorMs = MAX_ACCUMULATOR_MS
    }
    if (nowMs - lastControlMs >= CONTROL_INTERVAL_MS) {
      updateControls(nowMs)
      lastControlMs = nowMs
    }
    const stepStart = performance.now()
    let steps = 0
    while (accumulatorMs >= PHYSICS_STEP_SECONDS * 1000) {
      mujoco.mj_step(model, data)
      accumulatorMs -= PHYSICS_STEP_SECONDS * 1000
      steps += 1
    }
    const cost = performance.now() - stepStart
    if (steps > 0) stepCostMs = stepCostMs * 0.9 + (cost / steps) * 0.1
    stepCounter += steps
  }

  if (nowMs - lastRateSampleMs >= 1000) {
    const seconds = (nowMs - lastRateSampleMs) / 1000
    measuredPhysicsHz = Math.round(stepCounter / seconds)
    measuredSnapshotHz = Math.round(snapshotCounter / seconds)
    stepCounter = 0
    snapshotCounter = 0
    lastRateSampleMs = nowMs
  }

  if (nowMs - lastSnapshotMs >= SNAPSHOT_INTERVAL_MS) {
    const simulatedMs = data.time * 1000
    const perf: PerformanceSample = {
      physicsHz: measuredPhysicsHz,
      snapshotHz: measuredSnapshotHz,
      realtimeFactor: nowMs > 0 ? Math.min(9.99, simulatedMs / nowMs) : 0,
      stepCostMs,
      droppedTimeMs,
      contacts: data.ncon,
    }
    post({ type: 'snapshot', snapshot: { robot: makeRobotState(nowMs), targets: makeActuatorTargets(nowMs), bodies: readBodies(), performance: perf } })
    lastSnapshotMs = nowMs
    snapshotCounter += 1
  }
}

function resetSimulation() {
  if (!mujoco || !model || !data) return
  stopTargets()
  mujoco.mj_resetData(model, data)
  applyAuthoredHomePose()
  resetTargets()
  updateControls(performance.now())
  mujoco.mj_forward(model, data)
  accumulatorMs = 0
  droppedTimeMs = 0
  lastLoopMs = performance.now()
}

function restoreSimulation(state: RobotState) {
  if (!mujoco || !model || !data) return
  mujoco.mj_resetData(model, data)
  resetTargets()

  const base = model.jnt('base_free')
  try {
    const address = readScalar(base.qposadr)
    const pose = [...state.base.position, ...state.base.orientation]
    pose.forEach((value, offset) => { data!.qpos[address + offset] = value })
  } finally {
    base.delete()
  }

  if (state.lift.value !== null) {
    desired.liftTarget = Math.min(DEFAULT_CONTROL_CONFIG.liftMax, Math.max(DEFAULT_CONTROL_CONFIG.liftMin, state.lift.value))
    setJointPosition('lift', desired.liftTarget)
  }
  for (const joint of JOINT_NAMES) {
    const value = state.joints[joint].value
    if (value === null) continue
    const limits = DEFAULT_CONTROL_CONFIG.joints[joint]
    desired.jointTargets[joint] = Math.min(limits.max, Math.max(limits.min, value))
    setJointPosition(joint, desired.jointTargets[joint])
  }
  updateControls(performance.now())
  mujoco.mj_forward(model, data)
  accumulatorMs = 0
  droppedTimeMs = 0
  lastLoopMs = performance.now()
}

async function initialize(modelUrl: string) {
  try {
    post({ type: 'loading', detail: 'Loading MuJoCo WebAssembly' })
    mujoco = await loadMujoco({
      locateFile: (path: string) => path.endsWith('.wasm') ? mujocoWasmUrl : path,
    })
    post({ type: 'loading', detail: 'Compiling Kural model' })
    const modelPath = await writeModelFiles(mujoco, modelUrl)
    model = mujoco.MjModel.from_xml_path(modelPath)
    data = new mujoco.MjData(model)
    discoverModel()
    resetSimulation()
    post({ type: 'ready', bodyNames, actuatorNames })
    timer = workerScope.setInterval(loop, 4)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    post({ type: 'error', error: 'MuJoCo could not start', detail: message })
  }
}

function shutdown() {
  if (timer !== null) workerScope.clearInterval(timer)
  timer = null
  data?.delete()
  model?.delete()
  data = null
  model = null
  workerScope.close()
}

workerScope.onmessage = ({ data: message }: MessageEvent<MainToWorkerMessage>) => {
  if (message.type === 'initialize') void initialize(message.modelUrl)
  else if (message.type === 'command') acceptCommand(message.command)
  else if (message.type === 'pause') {
    paused = message.paused
    stopTargets()
    accumulatorMs = 0
    lastLoopMs = performance.now()
  } else if (message.type === 'reset') resetSimulation()
  else if (message.type === 'restore') restoreSimulation(message.state)
  else if (message.type === 'shutdown') shutdown()
}
