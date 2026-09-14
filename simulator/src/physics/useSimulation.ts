import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_CONTROL_CONFIG } from '../control'
import { commandExpiry, type ActuatorTargets, type CommandPayload, type RobotState, type SemanticCommand } from '../types'
import type { MainToWorkerMessage, SimulationSnapshot, SimulationStatus, WorkerToMainMessage } from './protocol'
import { simulatorAsset } from '../robot/paths'

interface RecordedCommand {
  offsetMs: number
  payload: CommandPayload
}

interface KuralRecording {
  format: 'kural-command-recording-v1'
  modelRevision: string
  configRevision: string
  createdAt: string
  initialState: RobotState | null
  commands: RecordedCommand[]
  stateSamples: { offsetMs: number; state: RobotState }[]
  targetSamples: { offsetMs: number; targets: ActuatorTargets }[]
}

export interface SimulationApi {
  status: SimulationStatus
  detail: string
  snapshot: SimulationSnapshot | null
  bodyNames: string[]
  actuatorNames: string[]
  recording: boolean
  replaying: boolean
  send: (payload: CommandPayload) => void
  pause: (paused: boolean) => void
  reset: () => void
  startRecording: () => void
  stopRecording: () => void
  replay: (file: File) => Promise<void>
}

export function useSimulation(): SimulationApi {
  const workerRef = useRef<Worker | null>(null)
  const sessionIdRef = useRef(crypto.randomUUID())
  const sequenceRef = useRef(0)
  const recordingRef = useRef<KuralRecording | null>(null)
  const recordStartRef = useRef(0)
  const replayTimersRef = useRef<number[]>([])
  const [status, setStatus] = useState<SimulationStatus>('loading')
  const [detail, setDetail] = useState('Starting physics worker')
  const [snapshot, setSnapshot] = useState<SimulationSnapshot | null>(null)
  const [bodyNames, setBodyNames] = useState<string[]>([])
  const [actuatorNames, setActuatorNames] = useState<string[]>([])
  const [recording, setRecording] = useState(false)
  const [replaying, setReplaying] = useState(false)

  useEffect(() => {
    const worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = ({ data: message }: MessageEvent<WorkerToMainMessage>) => {
      if (message.type === 'loading') {
        setStatus('loading')
        setDetail(message.detail)
      } else if (message.type === 'ready') {
        setStatus('ready')
        setDetail('MuJoCo online')
        setBodyNames(message.bodyNames)
        setActuatorNames(message.actuatorNames)
      } else if (message.type === 'snapshot') {
        setSnapshot(message.snapshot)
        if (message.snapshot.robot.paused) setStatus('paused')
        else setStatus((current) => current === 'error' ? current : 'ready')
        const active = recordingRef.current
        if (active) {
          const offsetMs = performance.now() - recordStartRef.current
          active.stateSamples.push({ offsetMs, state: message.snapshot.robot })
          active.targetSamples.push({ offsetMs, targets: message.snapshot.targets })
        }
      } else if (message.type === 'error') {
        setStatus('error')
        setDetail(message.detail ? `${message.error}: ${message.detail}` : message.error)
      }
    }
    worker.onerror = (event) => {
      setStatus('error')
      setDetail(event.message || 'Physics worker crashed')
    }
    worker.postMessage({ type: 'initialize', modelUrl: simulatorAsset('robot/scene/kural.xml') } satisfies MainToWorkerMessage)
    return () => {
      replayTimersRef.current.forEach(window.clearTimeout)
      worker.postMessage({ type: 'shutdown' } satisfies MainToWorkerMessage)
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const send = useCallback((payload: CommandPayload) => {
    const issuedAtMs = Date.now()
    const command: SemanticCommand = {
      ...payload,
      sequence: sequenceRef.current++,
      sessionId: sessionIdRef.current,
      configRevision: DEFAULT_CONTROL_CONFIG.revision,
      issuedAtMs,
      expiresAtMs: commandExpiry(issuedAtMs, DEFAULT_CONTROL_CONFIG.commandTimeoutMs),
    }
    workerRef.current?.postMessage({ type: 'command', command } satisfies MainToWorkerMessage)
    const active = recordingRef.current
    if (active) active.commands.push({ offsetMs: performance.now() - recordStartRef.current, payload })
  }, [])

  const pause = useCallback((next: boolean) => {
    workerRef.current?.postMessage({ type: 'pause', paused: next } satisfies MainToWorkerMessage)
    setStatus(next ? 'paused' : 'ready')
    setDetail(next ? 'Simulation paused' : 'MuJoCo online')
  }, [])

  const reset = useCallback(() => {
    workerRef.current?.postMessage({ type: 'reset' } satisfies MainToWorkerMessage)
  }, [])

  const startRecording = useCallback(() => {
    recordStartRef.current = performance.now()
    recordingRef.current = {
      format: 'kural-command-recording-v1',
      modelRevision: DEFAULT_CONTROL_CONFIG.modelRevision,
      configRevision: DEFAULT_CONTROL_CONFIG.revision,
      createdAt: new Date().toISOString(),
      initialState: snapshot?.robot ?? null,
      commands: [],
      stateSamples: [],
      targetSamples: [],
    }
    setRecording(true)
  }, [snapshot])

  const stopRecording = useCallback(() => {
    const result = recordingRef.current
    recordingRef.current = null
    setRecording(false)
    if (!result) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `kural-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [])

  const replay = useCallback(async (file: File) => {
    replayTimersRef.current.forEach(window.clearTimeout)
    replayTimersRef.current = []
    const candidate = JSON.parse(await file.text()) as KuralRecording
    if (
      candidate.format !== 'kural-command-recording-v1' ||
      candidate.modelRevision !== DEFAULT_CONTROL_CONFIG.modelRevision ||
      candidate.configRevision !== DEFAULT_CONTROL_CONFIG.revision
    ) {
      throw new Error('Recording was created for a different Kural model or control revision')
    }
    if (!candidate.initialState) throw new Error('Recording has no initial simulation state')
    workerRef.current?.postMessage({ type: 'restore', state: candidate.initialState } satisfies MainToWorkerMessage)
    setReplaying(true)
    for (const command of candidate.commands) {
      replayTimersRef.current.push(window.setTimeout(() => send(command.payload), command.offsetMs))
    }
    const duration = candidate.commands.at(-1)?.offsetMs ?? 0
    replayTimersRef.current.push(window.setTimeout(() => setReplaying(false), duration + 100))
  }, [send])

  return { status, detail, snapshot, bodyNames, actuatorNames, recording, replaying, send, pause, reset, startRecording, stopRecording, replay }
}
