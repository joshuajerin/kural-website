import { describe, expect, it } from 'vitest'
import { DryRunBackend } from '../src/control'
import { mapJoints } from '../src/types'
import { testConfig } from './fixtures'

describe('DryRunBackend', () => {
  it('captures targets without pretending to have measured feedback', async () => {
    const config = testConfig()
    const backend = new DryRunBackend()
    await backend.initialize(config)
    const state = await backend.readState()

    expect(state.lift).toEqual({ value: null, velocity: null, source: 'unavailable' })
    expect(Object.values(state.joints).every((joint) => joint.source === 'unavailable')).toBe(true)

    await backend.applyTargets({
      timestampMs: 50,
      wheelVelocities: Object.fromEntries(config.wheels.map((wheel) => [wheel.name, 0])),
      liftPosition: 0.43,
      liftVelocity: 0,
      jointPositions: { ...config.neutralJoints },
      jointVelocities: mapJoints(() => 0),
      activeGesture: null,
      stopped: true,
    })

    expect(backend.targetHistory).toHaveLength(1)
    expect((await backend.readState()).sequence).toBe(1)
  })
})
