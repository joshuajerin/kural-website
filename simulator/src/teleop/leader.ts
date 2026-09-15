import { DEFAULT_CONTROL_CONFIG } from '../control'
import type { JointName, RobotState } from '../types'

export const DEFAULT_LEADER_BRIDGE_URL = 'http://127.0.0.1:8767'
export const LEADER_POLL_INTERVAL_MS = 50
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

function wrapTicks(delta: number): number {
  return ((delta + TICKS_PER_REVOLUTION / 2) % TICKS_PER_REVOLUTION + TICKS_PER_REVOLUTION) % TICKS_PER_REVOLUTION - TICKS_PER_REVOLUTION / 2
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
      const deltaRadians = wrapTicks(sample[name] - mapping.source[name]) * RADIANS_PER_TICK
      return [name, Math.min(limit.max, Math.max(limit.min, mapping.target[name] + deltaRadians))]
    }),
  ) as Record<JointName, number>
}
