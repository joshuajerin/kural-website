import type { GestureId, JointName } from '../types'

export type ContinuousControlAction =
  | 'forward'
  | 'backward'
  | 'strafeLeft'
  | 'strafeRight'
  | 'rotateLeft'
  | 'rotateRight'
  | 'liftUp'
  | 'liftDown'
  | 'jogNegative'
  | 'jogPositive'
  | 'precision'

export type DiscreteControlAction =
  | { kind: 'selectJoint'; offset: -1 | 1 }
  | { kind: 'toggleGripper' }
  | { kind: 'gesture'; gesture: GestureId }
  | { kind: 'stop' }
  | { kind: 'cycleCamera' }

export const CONTINUOUS_KEY_BINDINGS: Readonly<Record<string, ContinuousControlAction>> = {
  KeyW: 'forward',
  KeyS: 'backward',
  KeyA: 'strafeLeft',
  KeyD: 'strafeRight',
  ArrowLeft: 'rotateLeft',
  KeyQ: 'rotateLeft',
  ArrowRight: 'rotateRight',
  KeyE: 'rotateRight',
  ArrowUp: 'liftUp',
  ArrowDown: 'liftDown',
  KeyJ: 'jogNegative',
  KeyL: 'jogPositive',
  ShiftLeft: 'precision',
  ShiftRight: 'precision',
}

export const DISCRETE_KEY_BINDINGS: Readonly<Record<string, DiscreteControlAction>> = {
  BracketLeft: { kind: 'selectJoint', offset: -1 },
  BracketRight: { kind: 'selectJoint', offset: 1 },
  KeyG: { kind: 'toggleGripper' },
  Digit1: { kind: 'gesture', gesture: 'home' },
  Digit2: { kind: 'gesture', gesture: 'wave' },
  Digit3: { kind: 'gesture', gesture: 'point' },
  Digit4: { kind: 'gesture', gesture: 'inspect' },
  Digit5: { kind: 'gesture', gesture: 'stow' },
  Space: { kind: 'stop' },
  Escape: { kind: 'stop' },
  KeyC: { kind: 'cycleCamera' },
}

export interface KeyboardIntent {
  vx: number
  vy: number
  yawRate: number
  liftVelocity: number
  jogVelocity: number
  precision: boolean
}

export function keyboardIntentFromActions(
  actions: ReadonlySet<ContinuousControlAction>,
  maxLinearVelocity: number,
  maxYawRate: number,
  liftMaxVelocity: number,
  jointMaxVelocity: number,
): KeyboardIntent {
  const axis = (positive: ContinuousControlAction, negative: ContinuousControlAction) =>
    Number(actions.has(positive)) - Number(actions.has(negative))
  const forward = axis('forward', 'backward')
  const strafe = axis('strafeLeft', 'strafeRight')
  const magnitude = Math.hypot(forward, strafe)
  const normalization = magnitude > 1 ? 1 / magnitude : 1
  const precision = actions.has('precision')
  const scale = precision ? 0.25 : 1

  return {
    vx: forward * normalization * maxLinearVelocity * scale,
    vy: strafe * normalization * maxLinearVelocity * scale,
    yawRate: axis('rotateLeft', 'rotateRight') * maxYawRate * scale,
    liftVelocity: axis('liftUp', 'liftDown') * liftMaxVelocity * scale,
    jogVelocity: axis('jogPositive', 'jogNegative') * jointMaxVelocity * scale,
    precision,
  }
}

export function selectJoint(current: JointName, offset: -1 | 1, joints: readonly JointName[]): JointName {
  const index = joints.indexOf(current)
  const next = (Math.max(index, 0) + offset + joints.length) % joints.length
  return joints[next]
}

