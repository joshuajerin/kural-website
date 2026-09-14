import type { RobotControlConfig, WheelDefinition } from '../types'
import { clamp, finite } from './math'

export interface ChassisVelocity {
  vx: number
  vy: number
  yawRate: number
}

export interface WheelKinematicsResult {
  wheelVelocities: Record<string, number>
  saturationScale: number
  requested: ChassisVelocity
  limited: ChassisVelocity
}

function normalizedDirection(wheel: WheelDefinition): readonly [number, number] {
  const magnitude = Math.hypot(...wheel.rollingDirection)
  if (!finite(magnitude) || magnitude <= 0) {
    throw new Error(`Wheel ${wheel.name} has an invalid rolling direction`)
  }
  return [wheel.rollingDirection[0] / magnitude, wheel.rollingDirection[1] / magnitude]
}

export function calculateOmniWheelTargets(
  requested: ChassisVelocity,
  config: Pick<RobotControlConfig, 'maxLinearVelocity' | 'maxYawRate' | 'wheels'>,
): WheelKinematicsResult {
  if (!finite(requested.vx, requested.vy, requested.yawRate)) {
    throw new Error('Chassis velocity must contain finite values')
  }

  const translationMagnitude = Math.hypot(requested.vx, requested.vy)
  const translationScale =
    translationMagnitude > config.maxLinearVelocity
      ? config.maxLinearVelocity / translationMagnitude
      : 1
  const limited = {
    vx: requested.vx * translationScale,
    vy: requested.vy * translationScale,
    yawRate: clamp(requested.yawRate, -config.maxYawRate, config.maxYawRate),
  }

  const raw = Object.fromEntries(
    config.wheels.map((wheel) => {
      if (wheel.radius <= 0 || wheel.maxAngularVelocity <= 0) {
        throw new Error(`Wheel ${wheel.name} has invalid physical limits`)
      }
      const [dx, dy] = normalizedDirection(wheel)
      const contactVx = limited.vx - limited.yawRate * wheel.position[1]
      const contactVy = limited.vy + limited.yawRate * wheel.position[0]
      const angularVelocity =
        (wheel.motorSign * (dx * contactVx + dy * contactVy)) / wheel.radius
      return [wheel.name, angularVelocity]
    }),
  )

  let saturationScale = 1
  for (const wheel of config.wheels) {
    const magnitude = Math.abs(raw[wheel.name])
    if (magnitude > wheel.maxAngularVelocity) {
      saturationScale = Math.min(saturationScale, wheel.maxAngularVelocity / magnitude)
    }
  }

  return {
    wheelVelocities: Object.fromEntries(
      Object.entries(raw).map(([name, value]) => {
        const scaled = value * saturationScale
        return [name, scaled === 0 ? 0 : scaled]
      }),
    ),
    saturationScale,
    requested: { ...requested },
    limited,
  }
}
