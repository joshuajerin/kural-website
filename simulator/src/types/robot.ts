export const JOINT_NAMES = [
  'shoulder_pan',
  'shoulder_lift',
  'elbow_flex',
  'wrist_flex',
  'wrist_roll',
  'gripper',
] as const

export type JointName = (typeof JOINT_NAMES)[number]

export const GESTURE_IDS = ['home', 'wave', 'point', 'inspect', 'stow'] as const

export type GestureId = (typeof GESTURE_IDS)[number]

export type FeedbackSource = 'simulated' | 'measured' | 'estimated' | 'unavailable'

export interface ScalarFeedback {
  value: number | null
  velocity: number | null
  source: FeedbackSource
}

export interface BaseState {
  position: readonly [number, number, number]
  orientation: readonly [number, number, number, number]
  velocity: readonly [number, number, number]
}

export interface RobotState {
  timestampMs: number
  sequence: number
  modelRevision: string
  configRevision: string
  base: BaseState
  lift: ScalarFeedback
  joints: Record<JointName, ScalarFeedback>
  paused: boolean
  fault: string | null
}

export interface JointLimit {
  min: number
  max: number
  maxVelocity: number
  maxAcceleration: number
  maxEffort: number
}

export interface WheelDefinition {
  name: string
  position: readonly [number, number]
  rollingDirection: readonly [number, number]
  radius: number
  motorSign: 1 | -1
  maxAngularVelocity: number
}

export interface RobotControlConfig {
  revision: string
  modelRevision: string
  commandTimeoutMs: number
  maxLinearVelocity: number
  maxYawRate: number
  maxWheelAcceleration: number
  liftMin: number
  liftMax: number
  liftMaxVelocity: number
  joints: Record<JointName, JointLimit>
  neutralJoints: Record<JointName, number>
  wheels: readonly WheelDefinition[]
}

export interface ActuatorTargets {
  timestampMs: number
  wheelVelocities: Record<string, number>
  liftPosition: number
  liftVelocity: number
  jointPositions: Record<JointName, number>
  jointVelocities: Record<JointName, number>
  activeGesture: GestureId | null
  stopped: boolean
}

export interface BackendCapabilities {
  kind: 'mujoco' | 'dry-run' | 'hardware'
  feedback: FeedbackSource
  resetSimulation: boolean
}

export interface RobotBackend {
  readonly capabilities: BackendCapabilities
  initialize(config: RobotControlConfig): Promise<void>
  readState(): Promise<RobotState>
  applyTargets(targets: ActuatorTargets): Promise<void>
  stop(): Promise<void>
  shutdown(): Promise<void>
  resetSimulation?(): Promise<void>
}

export function mapJoints<T>(factory: (name: JointName) => T): Record<JointName, T> {
  return Object.fromEntries(JOINT_NAMES.map((name) => [name, factory(name)])) as Record<
    JointName,
    T
  >
}

