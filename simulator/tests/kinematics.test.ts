import { describe, expect, it } from 'vitest'
import { calculateOmniWheelTargets } from '../src/control'
import { testConfig } from './fixtures'

describe('three-wheel omni kinematics', () => {
  it('maps forward, strafe, and yaw to distinct wheel patterns', () => {
    const config = testConfig({ maxLinearVelocity: 10, maxYawRate: 10 })
    const forward = calculateOmniWheelTargets({ vx: 0.2, vy: 0, yawRate: 0 }, config)
    const strafe = calculateOmniWheelTargets({ vx: 0, vy: 0.2, yawRate: 0 }, config)
    const rotate = calculateOmniWheelTargets({ vx: 0, vy: 0, yawRate: 0.5 }, config)

    // The actual front axle differs slightly from the centroid-facing heading.
    expect(Math.abs(forward.wheelVelocities.wheel_front)).toBeLessThan(0.02)
    expect(forward.wheelVelocities.wheel_rear_left).toBeGreaterThan(0)
    expect(forward.wheelVelocities.wheel_rear_right).toBeLessThan(0)
    expect(strafe.wheelVelocities.wheel_front).toBeLessThan(0)
    expect(rotate.wheelVelocities.wheel_front).toBeLessThan(0)
    expect(rotate.wheelVelocities.wheel_rear_left).toBeLessThan(0)
    expect(rotate.wheelVelocities.wheel_rear_right).toBeLessThan(0)
  })

  it('uniformly scales wheel targets when any wheel saturates', () => {
    const config = testConfig({ maxLinearVelocity: 100, maxYawRate: 100 })
    config.wheels = config.wheels.map((wheel) => ({ ...wheel, maxAngularVelocity: 2 }))
    const unconstrained = testConfig({ maxLinearVelocity: 100, maxYawRate: 100 })
    unconstrained.wheels = unconstrained.wheels.map((wheel) => ({
      ...wheel,
      maxAngularVelocity: 1_000,
    }))

    const requested = { vx: 1.1, vy: -0.4, yawRate: 1.7 }
    const raw = calculateOmniWheelTargets(requested, unconstrained)
    const saturated = calculateOmniWheelTargets(requested, config)

    expect(saturated.saturationScale).toBeLessThan(1)
    for (const wheel of config.wheels) {
      expect(Math.abs(saturated.wheelVelocities[wheel.name])).toBeLessThanOrEqual(2)
      expect(saturated.wheelVelocities[wheel.name]).toBeCloseTo(
        raw.wheelVelocities[wheel.name] * saturated.saturationScale,
      )
    }
  })
})
