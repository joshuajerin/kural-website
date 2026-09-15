import { JOINT_NAMES, type GestureId, type JointName, type RobotControlConfig } from '../types'
import { DEFAULT_NEUTRAL_JOINTS, STOW_JOINTS } from './config'

export interface GestureKeyframe {
  durationMs: number
  targets: Partial<Record<JointName, number>>
}

export interface GestureDefinition {
  id: GestureId
  label: string
  keyframes: readonly GestureKeyframe[]
}

/** Cubic smoothstep peaks at 1.5*d/T velocity and 6*d/T² acceleration. */
export function gestureSegmentDuration(from: Record<JointName, number>, frame: GestureKeyframe, config: RobotControlConfig): number {
  return Math.max(frame.durationMs, ...JOINT_NAMES.map(name => {
    const distance = Math.abs((frame.targets[name] ?? from[name]) - from[name])
    return 1000 * Math.max(1.5 * distance / config.joints[name].maxVelocity,
      Math.sqrt(6 * distance / config.joints[name].maxAcceleration))
  }))
}

export const GESTURES: Record<GestureId, GestureDefinition> = {
  home: {
    id: 'home',
    label: 'Home',
    keyframes: [
      {
        durationMs: 1200,
        targets: { ...DEFAULT_NEUTRAL_JOINTS },
      },
    ],
  },
  wave: {
    id: 'wave',
    label: 'Wave',
    keyframes: [
      { durationMs: 1800, targets: { shoulder_pan: 0, shoulder_lift: -0.85, elbow_flex: -0.25, wrist_flex: -0.55, wrist_roll: 0, gripper: 0.4 } },
      { durationMs: 1100, targets: { wrist_roll: -0.55 } },
      { durationMs: 1400, targets: { wrist_roll: 0.55 } },
      { durationMs: 1400, targets: { wrist_roll: -0.55 } },
      { durationMs: 1400, targets: { wrist_roll: 0.55 } },
      { durationMs: 1100, targets: { wrist_roll: 0 } },
    ],
  },
  point: {
    id: 'point',
    label: 'Point forward',
    keyframes: [
      { durationMs: 1800, targets: { shoulder_pan: 0, shoulder_lift: -0.7, elbow_flex: -0.4, wrist_flex: -0.55, wrist_roll: 0, gripper: 0.2 } },
    ],
  },
  inspect: {
    id: 'inspect',
    label: 'Inspection pose',
    keyframes: [
      { durationMs: 1800, targets: { shoulder_pan: 0.35, shoulder_lift: -0.9, elbow_flex: 0.2, wrist_flex: -0.95, wrist_roll: 0.45, gripper: 0.65 } },
    ],
  },
  stow: {
    id: 'stow',
    label: 'Stow',
    keyframes: [
      { durationMs: 1500, targets: { ...STOW_JOINTS } },
    ],
  },
}
