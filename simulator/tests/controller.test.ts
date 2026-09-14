import { describe, expect, it } from 'vitest'
import { KuralController } from '../src/control'
import { command, testConfig, testState } from './fixtures'

describe('KuralController command safety', () => {
  it('rejects wrong session, wrong config, stale sequence, and expired commands', () => {
    const config = testConfig()
    const controller = new KuralController('test-session', config)

    expect(
      controller.accept(command({ kind: 'stop' }, { sessionId: 'other' })),
    ).toEqual({ accepted: false, reason: 'wrong-session' })
    expect(
      controller.accept(command({ kind: 'stop' }, { configRevision: 'other' })),
    ).toEqual({ accepted: false, reason: 'wrong-config' })
    expect(controller.accept(command({ kind: 'stop' }))).toEqual({ accepted: true })
    expect(controller.accept(command({ kind: 'stop' }))).toEqual({
      accepted: false,
      reason: 'stale-sequence',
    })
    expect(
      controller.accept(
        command(
          { kind: 'drive', vx: 0.1, vy: 0, yawRate: 0 },
          { sequence: 2, issuedAtMs: 0, expiresAtMs: 10 },
        ),
        10,
      ),
    ).toEqual({ accepted: false, reason: 'expired' })
    expect(
      controller.accept(
        command({ kind: 'stop' }, { sequence: 3, issuedAtMs: 0, expiresAtMs: 10 }),
        20,
      ),
    ).toEqual({ accepted: true })
  })

  it('expires held motion at 250 ms and decelerates wheels', () => {
    const config = testConfig({ maxWheelAcceleration: 20 })
    const controller = new KuralController('test-session', config)
    const state = testState(config)
    controller.update(0, 0, state)
    controller.accept(
      command({ kind: 'drive', vx: 0.4, vy: 0, yawRate: 0 }, { expiresAtMs: 250 }),
    )

    const moving = controller.update(100, 0.1, state)
    expect(Object.values(moving.wheelVelocities).some((speed) => Math.abs(speed) > 0)).toBe(true)
    const expired = controller.update(250, 0.05, state)
    expect(expired.stopped).toBe(true)
    expect(
      Object.values(expired.wheelVelocities).every(
        (speed, index) =>
          Math.abs(speed) <=
          Math.abs(Object.values(moving.wheelVelocities)[index]) + Number.EPSILON,
      ),
    ).toBe(true)
    const settled = controller.update(1000, 1, state)
    expect(Object.values(settled.wheelVelocities)).toEqual([0, 0, 0])
  })

  it('stops and holds lift and arm targets', () => {
    const config = testConfig()
    const controller = new KuralController('test-session', config)
    const state = testState(config)
    controller.update(0, 0, state)
    controller.accept(command({ kind: 'moveLift', velocity: 0.1 }))
    const moving = controller.update(100, 0.1, state)
    controller.accept(command({ kind: 'stop' }, { sequence: 2, issuedAtMs: 110, expiresAtMs: 360 }))
    const stopped = controller.update(120, 0.02, state)

    expect(stopped.liftPosition).toBeCloseTo(moving.liftPosition)
    expect(stopped.liftVelocity).toBe(0)
    expect(stopped.stopped).toBe(true)
  })
})
