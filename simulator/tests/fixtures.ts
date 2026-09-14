import {
  mapJoints,
  type RobotControlConfig,
  type RobotState,
  type SemanticCommand,
} from '../src/types'
import { DEFAULT_CONTROL_CONFIG } from '../src/control'

export function testConfig(
  overrides: Partial<RobotControlConfig> = {},
): RobotControlConfig {
  return {
    ...structuredClone(DEFAULT_CONTROL_CONFIG),
    ...overrides,
  }
}

export function testState(config = testConfig(), timestampMs = 0): RobotState {
  return {
    timestampMs,
    sequence: 0,
    modelRevision: config.modelRevision,
    configRevision: config.revision,
    base: {
      position: [0, 0, 0],
      orientation: [1, 0, 0, 0],
      velocity: [0, 0, 0],
    },
    lift: { value: 0.43, velocity: 0, source: 'simulated' },
    joints: mapJoints((joint) => ({
      value: config.neutralJoints[joint],
      velocity: 0,
      source: 'simulated',
    })),
    paused: false,
    fault: null,
  }
}

export function command<T extends Omit<SemanticCommand, keyof CommandDefaults>>(
  payload: T,
  defaults: Partial<CommandDefaults> = {},
): SemanticCommand {
  return {
    sequence: defaults.sequence ?? 1,
    sessionId: defaults.sessionId ?? 'test-session',
    configRevision: defaults.configRevision ?? DEFAULT_CONTROL_CONFIG.revision,
    issuedAtMs: defaults.issuedAtMs ?? 0,
    expiresAtMs: defaults.expiresAtMs ?? 250,
    ...payload,
  } as SemanticCommand
}

interface CommandDefaults {
  sequence: number
  sessionId: string
  configRevision: string
  issuedAtMs: number
  expiresAtMs: number
}

