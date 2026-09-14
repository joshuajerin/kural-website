import { describe, expect, it } from 'vitest'
import {
  KuralController,
  RecordingReplay,
  SessionRecorder,
  assertRecordingCompatible,
} from '../src/control'
import { command, testConfig, testState } from './fixtures'

describe('recording and replay', () => {
  it('records commands, generated targets, and states', () => {
    const config = testConfig()
    const state = testState(config, 1_000)
    const recorder = new SessionRecorder(state, 1_000)
    const controller = new KuralController('test-session', config)
    controller.setRecorder(recorder)
    controller.update(1_000, 0, state)
    controller.accept(
      command(
        { kind: 'drive', vx: 0.2, vy: 0, yawRate: 0 },
        { sequence: 1, issuedAtMs: 1_100, expiresAtMs: 1_350 },
      ),
    )
    controller.update(1_120, 0.02, { ...state, timestampMs: 1_120 })
    const recording = recorder.finish()

    expect(recording.commands).toHaveLength(1)
    expect(recording.commands[0].atMs).toBe(100)
    expect(recording.targets).toHaveLength(2)
    expect(recording.states).toHaveLength(2)
  })

  it('rejects incompatible recordings and rebases compatible command timing', () => {
    const config = testConfig()
    const state = testState(config, 100)
    const recorder = new SessionRecorder(state, 100)
    recorder.recordCommand(
      command(
        { kind: 'stop' },
        { sequence: 7, issuedAtMs: 140, expiresAtMs: 390 },
      ),
    )
    const recording = recorder.finish()

    expect(() => assertRecordingCompatible(recording, config)).not.toThrow()
    expect(() =>
      assertRecordingCompatible(recording, { ...config, modelRevision: 'other-model' }),
    ).toThrow(/does not match/)

    const replay = new RecordingReplay(recording, config, 'replay-session', 1_000)
    expect(replay.commandsDue(1_039)).toEqual([])
    expect(replay.commandsDue(1_040)[0]).toMatchObject({
      kind: 'stop',
      sequence: 1,
      sessionId: 'replay-session',
      issuedAtMs: 1_040,
      expiresAtMs: 1_290,
    })
    expect(replay.complete).toBe(true)
  })
})

