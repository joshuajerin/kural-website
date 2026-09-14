import { describe, expect, it } from 'vitest'
import { CONTINUOUS_KEY_BINDINGS, keyboardIntentFromActions } from '../src/control'

describe('keyboard intent contract', () => {
  it('uses side arrows for chassis rotation and vertical arrows for lift', () => {
    expect(CONTINUOUS_KEY_BINDINGS.ArrowLeft).toBe('rotateLeft')
    expect(CONTINUOUS_KEY_BINDINGS.ArrowRight).toBe('rotateRight')
    expect(CONTINUOUS_KEY_BINDINGS.ArrowUp).toBe('liftUp')
    expect(CONTINUOUS_KEY_BINDINGS.ArrowDown).toBe('liftDown')
  })

  it('normalizes diagonal translation and cancels opposing keys', () => {
    const diagonal = keyboardIntentFromActions(
      new Set(['forward', 'strafeLeft']),
      1,
      2,
      0.1,
      1,
    )
    expect(Math.hypot(diagonal.vx, diagonal.vy)).toBeCloseTo(1)
    const opposed = keyboardIntentFromActions(
      new Set(['rotateLeft', 'rotateRight', 'liftUp', 'liftDown']),
      1,
      2,
      0.1,
      1,
    )
    expect(opposed.yawRate).toBe(0)
    expect(opposed.liftVelocity).toBe(0)
  })
})

