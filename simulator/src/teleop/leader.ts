import { DEFAULT_CONTROL_CONFIG } from '../control'
import type { JointName, RobotState } from '../types'

export const DEFAULT_LEADER_BRIDGE_URL = 'http://127.0.0.1:8767'
export const LEADER_POLL_INTERVAL_MS = 50
/** Four quiet reads prevent a transient startup encoder value from arming teleop. */
export const LEADER_STABLE_SAMPLE_COUNT = 4
/** A manually held arm cannot legitimately move this far between 50 ms reads. */
export const MAX_LEADER_SAMPLE_DELTA_TICKS = 96
/** Limit the follower request to 3.4 degrees per received leader sample. */
export const MAX_LEADER_TARGET_STEP_RADIANS = 0.06
const TICKS_PER_REVOLUTION = 4096
const RADIANS_PER_TICK = (2 * Math.PI) / TICKS_PER_REVOLUTION

export type LeaderJointTicks = Record<JointName, number>

export interface LeaderSample {
  connected: boolean
  sequence: number
  timestampMs: number
  joints: LeaderJointTicks | null
  error?: string
}

export interface LeaderMapping {
  source: LeaderJointTicks
  target: Record<JointName, number>
}

function finiteTicks(joints: unknown): joints is LeaderJointTicks {
  if (!joints || typeof joints !== 'object') return false
  return Object.keys(DEFAULT_CONTROL_CONFIG.joints).every((joint) =>
    Number.isFinite((joints as Record<string, unknown>)[joint]),
  )
}

export function parseLeaderSample(value: unknown): LeaderSample | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<LeaderSample>
  if (typeof candidate.connected !== 'boolean' || !Number.isFinite(candidate.sequence) || !Number.isFinite(candidate.timestampMs)) {
    return null
  }
  if (candidate.joints !== null && !finiteTicks(candidate.joints)) return null
  return {
    connected: candidate.connected,
    sequence: candidate.sequence as number,
    timestampMs: candidate.timestampMs as number,
    joints: candidate.joints ?? null,
    error: typeof candidate.error === 'string' ? candidate.error : undefined,
  }
}

export function wrapLeaderTicks(delta: number): number {
  return ((delta + TICKS_PER_REVOLUTION / 2) % TICKS_PER_REVOLUTION + TICKS_PER_REVOLUTION) % TICKS_PER_REVOLUTION - TICKS_PER_REVOLUTION / 2
}

export function largestLeaderSampleDelta(previous: LeaderJointTicks, current: LeaderJointTicks): number {
  return Math.max(...Object.keys(DEFAULT_CONTROL_CONFIG.joints).map((joint) =>
    Math.abs(wrapLeaderTicks(current[joint as JointName] - previous[joint as JointName])),
  ))
}

export function beginLeaderMapping(source: LeaderJointTicks, robot: RobotState | null): LeaderMapping {
  const target = Object.fromEntries(
    Object.entries(DEFAULT_CONTROL_CONFIG.joints).map(([joint]) => {
      const name = joint as JointName
      return [name, robot?.joints[name].value ?? DEFAULT_CONTROL_CONFIG.neutralJoints[name]]
    }),
  ) as Record<JointName, number>
  return { source: { ...source }, target }
}

/**
 * The leader is used as a relative input so enabling it never snaps the simulated
 * arm to an unknown hardware zero. Both arms use the standard SO-101 joint order.
 */
export function targetsFromLeaderSample(mapping: LeaderMapping, sample: LeaderJointTicks): Record<JointName, number> {
  return Object.fromEntries(
    Object.entries(DEFAULT_CONTROL_CONFIG.joints).map(([joint, limit]) => {
      const name = joint as JointName
      const deltaRadians = wrapLeaderTicks(sample[name] - mapping.source[name]) * RADIANS_PER_TICK
      return [name, Math.min(limit.max, Math.max(limit.min, mapping.target[name] + deltaRadians))]
    }),
  ) as Record<JointName, number>
}

/**
 * Servos receive a bounded target change even if an input sample is valid but
 * arrives unusually late. It keeps a bad browser or serial sample from making
 * the follower snap to a distant pose.
 */
export function limitLeaderTargetStep(
  previous: Record<JointName, number>,
  requested: Record<JointName, number>,
): Record<JointName, number> {
  return Object.fromEntries(
    Object.entries(DEFAULT_CONTROL_CONFIG.joints).map(([joint, limit]) => {
      const name = joint as JointName
      const delta = Math.max(-MAX_LEADER_TARGET_STEP_RADIANS, Math.min(MAX_LEADER_TARGET_STEP_RADIANS, requested[name] - previous[name]))
      return [name, Math.min(limit.max, Math.max(limit.min, previous[name] + delta))]
    }),
  ) as Record<JointName, number>
}
