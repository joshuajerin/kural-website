import type { ActuatorTargets, RobotControlConfig, RobotState, SemanticCommand } from '../types'

export const RECORDING_FORMAT_VERSION = 1 as const

export interface TimedRecordingEntry<T> {
  atMs: number
  value: T
}

export interface KuralRecording {
  formatVersion: typeof RECORDING_FORMAT_VERSION
  createdAt: string
  modelRevision: string
  configRevision: string
  initialState: RobotState
  commands: Array<TimedRecordingEntry<SemanticCommand>>
  targets: Array<TimedRecordingEntry<ActuatorTargets>>
  states: Array<TimedRecordingEntry<RobotState>>
}

export interface RecordingSink {
  recordCommand(command: SemanticCommand): void
  recordFrame(state: RobotState, targets: ActuatorTargets): void
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

export class SessionRecorder implements RecordingSink {
  private readonly startMs: number
  private readonly recording: KuralRecording

  constructor(initialState: RobotState, startMs = initialState.timestampMs) {
    this.startMs = startMs
    this.recording = {
      formatVersion: RECORDING_FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      modelRevision: initialState.modelRevision,
      configRevision: initialState.configRevision,
      initialState: clone(initialState),
      commands: [],
      targets: [],
      states: [],
    }
  }

  recordCommand(command: SemanticCommand): void {
    this.recording.commands.push({ atMs: command.issuedAtMs - this.startMs, value: clone(command) })
  }

  recordFrame(state: RobotState, targets: ActuatorTargets): void {
    const atMs = state.timestampMs - this.startMs
    this.recording.states.push({ atMs, value: clone(state) })
    this.recording.targets.push({ atMs, value: clone(targets) })
  }

  finish(): KuralRecording {
    return clone(this.recording)
  }
}

export function assertRecordingCompatible(
  recording: KuralRecording,
  config: Pick<RobotControlConfig, 'revision' | 'modelRevision'>,
): void {
  if (recording.formatVersion !== RECORDING_FORMAT_VERSION) {
    throw new Error(`Unsupported recording format ${String(recording.formatVersion)}`)
  }
  if (recording.modelRevision !== config.modelRevision) {
    throw new Error(
      `Recording model ${recording.modelRevision} does not match ${config.modelRevision}`,
    )
  }
  if (recording.configRevision !== config.revision) {
    throw new Error(
      `Recording config ${recording.configRevision} does not match ${config.revision}`,
    )
  }
}

/** Replays recorded semantic commands with fresh timing and session identity. */
export class RecordingReplay {
  private cursor = 0

  constructor(
    private readonly recording: KuralRecording,
    config: Pick<RobotControlConfig, 'revision' | 'modelRevision'>,
    private readonly sessionId: string,
    private readonly startedAtMs: number,
  ) {
    assertRecordingCompatible(recording, config)
  }

  commandsDue(nowMs: number): SemanticCommand[] {
    const elapsedMs = Math.max(0, nowMs - this.startedAtMs)
    const due: SemanticCommand[] = []
    while (
      this.cursor < this.recording.commands.length &&
      this.recording.commands[this.cursor].atMs <= elapsedMs
    ) {
      const entry = this.recording.commands[this.cursor++]
      const original = entry.value
      const lifetime = Math.max(1, original.expiresAtMs - original.issuedAtMs)
      const issuedAtMs = this.startedAtMs + entry.atMs
      due.push({
        ...clone(original),
        sequence: this.cursor,
        sessionId: this.sessionId,
        configRevision: this.recording.configRevision,
        issuedAtMs,
        expiresAtMs: issuedAtMs + lifetime,
      })
    }
    return due
  }

  get complete(): boolean {
    return this.cursor >= this.recording.commands.length
  }

  reset(): void {
    this.cursor = 0
  }
}

