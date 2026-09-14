export const KURAL_MODEL_REVISION = 'kural-assembly-v1' as const

export const KURAL_MODEL_URLS = {
  manifest: simulatorAsset('robot/model-manifest.json'),
  visual: simulatorAsset('robot/assets/kural-assembly-v1.glb'),
  mjcf: simulatorAsset('robot/scene/kural.xml'),
} as const

export const KURAL_BODY_NAMES = {
  chassis: 'chassis',
  liftCarriage: 'lift_carriage',
  armMount: 'arm_mount',
  shoulderPan: 'shoulder_pan_link',
  shoulderLift: 'shoulder_lift_link',
  elbow: 'elbow_link',
  wristFlex: 'wrist_flex_link',
  wristRoll: 'wrist_roll_link',
  gripper: 'gripper_link',
} as const

export const KURAL_JOINT_NAMES = [
  'wheel_1', 'wheel_2', 'wheel_3', 'lift',
  'shoulder_pan', 'shoulder_lift', 'elbow_flex',
  'wrist_flex', 'wrist_roll', 'gripper',
] as const

export type KuralJointName = (typeof KURAL_JOINT_NAMES)[number]

export interface KuralModelManifest {
  schemaVersion: 1
  assetVersion: typeof KURAL_MODEL_REVISION
  coordinateSystems: { source: string; glb: string; mujoco: string; canonicalForward: string }
  source: {
    path: string
    sha256: string
    sceneUnitSystem: 'METRIC'
    sceneScaleLength: 1
    physicalCalibration: string
  }
  cameraAssets?: {
    revision: string
    manifestFile: string
    wrist: { visualFile: string; sha256: string; mountFile: string; mountSha256: string; parentBody: string; status: string }
    mast: { visualFile: string; sha256: string; mountFile: string; mountSha256: string; parentBody: string; overallLengthM: number; pitchDownDegrees: number }
  }
  visualAsset: { file: string; sha256: string; bytes: number; objectCount: number }
  dimensions: {
    wheelNominalDiameterM: number
    wheelEvaluatedDiametersM: number[]
    wheelWidthAuthoredM: number
    railSectionM: [number, number]
    railExposedHeightM: number
    liftTravelM: number
    liftAuthoredPositionM: number
    beltTravelPerRevolutionM: number
  }
  stableNodes: { root: string; lift: string; armMount: string; wheels: string[]; armJoints: string[] }
  parameterStatus: Record<string, string>
  knownLimitations: string[]
}

export async function loadKuralManifest(signal?: AbortSignal): Promise<KuralModelManifest> {
  const response = await fetch(KURAL_MODEL_URLS.manifest, { signal })
  if (!response.ok) throw new Error(`Failed to load Kural model manifest (${response.status})`)
  const manifest = (await response.json()) as KuralModelManifest
  if (manifest.assetVersion !== KURAL_MODEL_REVISION) {
    throw new Error(`Kural model revision mismatch: expected ${KURAL_MODEL_REVISION}, received ${manifest.assetVersion}`)
  }
  return manifest
}
import { simulatorAsset } from './paths'
