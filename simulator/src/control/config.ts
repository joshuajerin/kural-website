import { mapJoints, type JointName, type RobotControlConfig } from '../types'
import wheelGeometry from '../../public/robot/wheel-geometry.json'
import binding from '../../public/robot/assembly-binding.json'

const jointRanges: Record<JointName, readonly [number, number, number]> = {
  shoulder_pan: [-1.919, 1.919, 1.5],
  shoulder_lift: [-1.745, 1.745, 1.5],
  elbow_flex: [-1.69, 1.69, 1.8],
  wrist_flex: [-1.658, 1.658, 2.0],
  wrist_roll: [-2.74385, 2.84121, 2.5],
  gripper: [-0.174533, 1.74533, 2.0],
}

/**
 * Global SO-101 neutral/stow pose measured in the simulator joint panel.
 * These values are intentionally explicit: this is the pose the leader and
 * simulated arm must share before teleoperation begins.
 */
export const STOW_JOINTS: Record<JointName, number> = {
  shoulder_pan: 0,
  shoulder_lift: -99.4 * Math.PI / 180,
  elbow_flex: 79.1 * Math.PI / 180,
  wrist_flex: 65.1 * Math.PI / 180,
  wrist_roll: 90.3 * Math.PI / 180,
  gripper: -10 * Math.PI / 180,
}

export const DEFAULT_NEUTRAL_JOINTS: Record<JointName, number> = { ...STOW_JOINTS }

/**
 * Uncalibrated control defaults. Geometry and actuator values remain explicit so
 * they can be replaced by measured values without changing controller logic.
 */
export const DEFAULT_CONTROL_CONFIG: RobotControlConfig = {
  revision: 'kural-control-v10',
  modelRevision: 'xlerobot-full-spine-arm-single-wheel-v9',
  commandTimeoutMs: 250,
  maxLinearVelocity: 0.2,
  maxYawRate: 0.7,
  maxWheelAcceleration: 8,
  liftMin: 0,
  liftMax: 0.86,
  liftMaxVelocity: 0.12,
  joints: mapJoints((name) => ({
    min: jointRanges[name][0],
    max: jointRanges[name][1],
    maxVelocity: jointRanges[name][2],
    maxAcceleration: 4,
    maxEffort: name === 'gripper' ? 3 : 8,
  })),
  neutralJoints: { ...DEFAULT_NEUTRAL_JOINTS },
  wheels: [2, 1, 3].map((index) => {
    const wheel = wheelGeometry.wheels.find(w => w.sourceIndex === index)!
    const transform = binding.sourceToSimulation
    const component = (row: number, vector: number[], point: boolean) =>
      vector.reduce((sum, value, axis) => sum + transform[row][axis] * value, point ? transform[row][3] : 0)
    const ax = component(0, wheel.axleSource, false), ay = component(1, wheel.axleSource, false)
    return {
      name: ({ 1: 'wheel_rear_left', 2: 'wheel_front', 3: 'wheel_rear_right' } as Record<number, string>)[index],
      position: [component(0, wheel.centerSourceM, true), component(1, wheel.centerSourceM, true)],
      rollingDirection: [-ay, ax],
      radius: 0.0508,
      motorSign: -1,
      maxAngularVelocity: 12,
    }
  }),
}
