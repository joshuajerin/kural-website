import { describe, expect, it } from 'vitest'
import { beginLeaderMapping, parseLeaderSample, targetsFromLeaderSample } from '../src/teleop/leader'

const raw = {
  shoulder_pan: 2040,
  shoulder_lift: 2040,
  elbow_flex: 2040,
  wrist_flex: 2040,
  wrist_roll: 2040,
  gripper: 2040,
}

describe('leader arm mapping', () => {
  it('accepts only complete bridge samples', () => {
    expect(parseLeaderSample({ connected: true, sequence: 2, timestampMs: 3, joints: raw })?.joints).toEqual(raw)
    expect(parseLeaderSample({ connected: true, sequence: 2, timestampMs: 3, joints: {} })).toBeNull()
  })

  it('starts from the current simulated pose and unwraps encoder travel', () => {
    const mapping = beginLeaderMapping({ ...raw, shoulder_pan: 4090 }, null)
    const targets = targetsFromLeaderSample(mapping, { ...raw, shoulder_pan: 3 })
    expect(targets.shoulder_pan).toBeGreaterThan(0)
    expect(targets.shoulder_pan).toBeLessThan(0.03)
  })
})
