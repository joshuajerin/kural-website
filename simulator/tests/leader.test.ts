import { describe, expect, it } from 'vitest'
import {
  MAX_LEADER_TARGET_STEP_RADIANS,
  beginLeaderMapping,
  largestLeaderSampleDelta,
  limitLeaderTargetStep,
  parseLeaderSample,
  targetsFromLeaderSample,
} from '../src/teleop/leader'

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

  it('detects a discontinuous encoder sample and bounds follower target updates', () => {
    expect(largestLeaderSampleDelta(raw, { ...raw, wrist_roll: raw.wrist_roll + 150 })).toBe(150)
    const mapping = beginLeaderMapping(raw, null)
    const requested = targetsFromLeaderSample(mapping, { ...raw, shoulder_lift: raw.shoulder_lift + 500 })
    const bounded = limitLeaderTargetStep(mapping.target, requested)
    expect(Math.abs(bounded.shoulder_lift - mapping.target.shoulder_lift)).toBeCloseTo(MAX_LEADER_TARGET_STEP_RADIANS, 10)
    expect(bounded.shoulder_lift).toBeLessThan(requested.shoulder_lift)
  })
})
