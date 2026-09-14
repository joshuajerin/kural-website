import type { GestureId, JointName } from './robot'

export interface CommandMeta {
  sequence: number
  sessionId: string
  configRevision: string
  issuedAtMs: number
  expiresAtMs: number
}

export type CommandPayload =
  | { kind: 'drive'; vx: number; vy: number; yawRate: number }
  | { kind: 'moveLift'; velocity: number }
  | { kind: 'jogJoint'; joint: JointName; velocity: number }
  | { kind: 'setJointTargets'; targets: Partial<Record<JointName, number>> }
  | { kind: 'setGripper'; position: number }
  | { kind: 'playGesture'; gesture: GestureId }
  | { kind: 'stop' }
  | { kind: 'resetSimulation' }

export type SemanticCommand = CommandMeta & CommandPayload

export type CommandKind = SemanticCommand['kind']

export interface CommandAcceptance {
  accepted: boolean
  reason?:
    | 'wrong-session'
    | 'wrong-config'
    | 'stale-sequence'
    | 'expired'
    | 'gesture-active'
    | 'invalid-value'
}

export function commandExpiry(issuedAtMs: number, timeoutMs: number): number {
  return issuedAtMs + timeoutMs
}

export function isContinuousCommand(
  command: SemanticCommand,
): command is Extract<SemanticCommand, { kind: 'drive' | 'moveLift' | 'jogJoint' }> {
  return command.kind === 'drive' || command.kind === 'moveLift' || command.kind === 'jogJoint'
}

