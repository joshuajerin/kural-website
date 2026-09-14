import { describe, expect, it } from 'vitest'
import { KuralController, GESTURES } from '../src/control'
import { gestureSegmentDuration } from '../src/control/gestures'
import { command, testConfig, testState } from './fixtures'

describe('gesture execution', () => {
  it('executes a named gesture and rejects a hidden queue', () => {
    const config = testConfig()
    const controller = new KuralController('test-session', config)
    const state = testState(config)
    controller.update(0, 0, state)

    expect(controller.accept(command({ kind: 'playGesture', gesture: 'wave' }))).toEqual({
      accepted: true,
    })
    expect(
      controller.accept(
        command(
          { kind: 'playGesture', gesture: 'point' },
          { sequence: 2, issuedAtMs: 10, expiresAtMs: 260 },
        ),
      ),
    ).toEqual({ accepted: false, reason: 'gesture-active' })
    expect(controller.update(1200, 0.02, state).activeGesture).toBe('wave')
    let pose = { ...config.neutralJoints }, duration = 0
    for (const frame of GESTURES.wave.keyframes) {
      duration += gestureSegmentDuration(pose, frame, config)
      pose = { ...pose, ...frame.targets }
    }
    expect(controller.update(duration - 1, 0.02, state).activeGesture).toBe('wave')
    expect(controller.update(duration + 1, 0.02, state).activeGesture).toBeNull()
  })

  it('manual motion interrupts a gesture', () => {
    const config = testConfig()
    const controller = new KuralController('test-session', config)
    const state = testState(config)
    controller.update(0, 0, state)
    controller.accept(command({ kind: 'playGesture', gesture: 'inspect' }))
    expect(controller.activeGesture).toBe('inspect')

    controller.accept(
      command(
        { kind: 'drive', vx: 0, vy: 0, yawRate: 0.5 },
        { sequence: 2, issuedAtMs: 20, expiresAtMs: 270 },
      ),
    )
    expect(controller.activeGesture).toBeNull()
    expect(
      Object.values(controller.update(30, 0.01, state).wheelVelocities).some(
        (speed) => speed !== 0,
      ),
    ).toBe(true)
  })
})
