import type { ChassisVelocity } from './kinematics'

/** Correct contact slip through wheel targets, never by moving the chassis. */
export class HeadingController {
  private target: number | null = null

  reset() { this.target = null }

  update(command: ChassisVelocity, measuredYaw: number, dt: number): ChassisVelocity {
    if (!command.vx && !command.vy && !command.yawRate) {
      this.reset()
      return { ...command }
    }
    this.target ??= measuredYaw
    this.target += command.yawRate * dt
    const difference = this.target - measuredYaw
    const error = Math.atan2(Math.sin(difference), Math.cos(difference))
    return { ...command, yawRate: command.yawRate + Math.max(-0.7, Math.min(0.7, 4 * error)) }
  }
}

export function quaternionYaw([w, x, y, z]: readonly number[]): number {
  return Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z))
}

export const SIMULATION_WHEEL_ACTUATORS: Record<string, string> = {
  wheel_front: 'wheel_2_motor',
  wheel_rear_left: 'wheel_1_motor',
  wheel_rear_right: 'wheel_3_motor',
}
