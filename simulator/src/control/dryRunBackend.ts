import {
  mapJoints,
  type ActuatorTargets,
  type RobotBackend,
  type RobotControlConfig,
  type RobotState,
} from '../types'

function clone<T>(value: T): T {
  return structuredClone(value)
}

export class DryRunBackend implements RobotBackend {
  readonly capabilities = {
    kind: 'dry-run' as const,
    feedback: 'unavailable' as const,
    resetSimulation: false,
  }

  readonly targetHistory: ActuatorTargets[] = []
  private state: RobotState | null = null
  private initialized = false

  async initialize(config: RobotControlConfig): Promise<void> {
    this.state = {
      timestampMs: 0,
      sequence: 0,
      modelRevision: config.modelRevision,
      configRevision: config.revision,
      base: {
        position: [0, 0, 0],
        orientation: [1, 0, 0, 0],
        velocity: [0, 0, 0],
      },
      lift: { value: null, velocity: null, source: 'unavailable' },
      joints: mapJoints(() => ({ value: null, velocity: null, source: 'unavailable' })),
      paused: false,
      fault: null,
    }
    this.initialized = true
  }

  async readState(): Promise<RobotState> {
    if (!this.initialized || !this.state) throw new Error('DryRunBackend is not initialized')
    return clone(this.state)
  }

  async applyTargets(targets: ActuatorTargets): Promise<void> {
    if (!this.initialized || !this.state) throw new Error('DryRunBackend is not initialized')
    this.targetHistory.push(clone(targets))
    this.state.timestampMs = targets.timestampMs
    this.state.sequence += 1
  }

  async stop(): Promise<void> {
    if (!this.initialized) throw new Error('DryRunBackend is not initialized')
  }

  async shutdown(): Promise<void> {
    this.initialized = false
    this.state = null
  }
}

