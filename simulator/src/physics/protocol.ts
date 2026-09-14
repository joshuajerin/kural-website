import type { ActuatorTargets, RobotState, SemanticCommand } from '../types'

export type CameraMode = 'orbit' | 'follow' | 'top' | 'arm' | 'wrist'

export interface BodyTransform {
  name: string
  position: [number, number, number]
  quaternion: [number, number, number, number]
}

export interface PerformanceSample {
  physicsHz: number
  snapshotHz: number
  realtimeFactor: number
  stepCostMs: number
  droppedTimeMs: number
  contacts: number
}

export interface SimulationSnapshot {
  robot: RobotState
  targets: ActuatorTargets
  bodies: BodyTransform[]
  performance: PerformanceSample
}

export type MainToWorkerMessage =
  | { type: 'initialize'; modelUrl: string }
  | { type: 'command'; command: SemanticCommand }
  | { type: 'pause'; paused: boolean }
  | { type: 'reset' }
  | { type: 'restore'; state: RobotState }
  | { type: 'shutdown' }

export type WorkerToMainMessage =
  | { type: 'loading'; detail: string }
  | { type: 'ready'; bodyNames: string[]; actuatorNames: string[] }
  | { type: 'snapshot'; snapshot: SimulationSnapshot }
  | { type: 'error'; error: string; detail?: string }

export type SimulationStatus = 'loading' | 'ready' | 'paused' | 'error'
