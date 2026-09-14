import * as THREE from 'three'
import type { BodyTransform } from '../physics/protocol'

export interface AssemblyBinding {
  sourceToSimulation: number[][]
  referenceBodies: { name: string; position: number[]; quaternion: number[] }[]
}

const basis = new THREE.Matrix4().makeRotationX(-Math.PI / 2)
const inverseBasis = basis.clone().invert()

export function bodyMatrix(body: { position: number[]; quaternion: number[] }): THREE.Matrix4 {
  return nativeFrameMatrix(body).multiply(inverseBasis)
}

/** Raw MuJoCo/Blender local coordinates -> Three world; no local basis undo. */
export function nativeFrameMatrix(body: { position: number[]; quaternion: number[] }): THREE.Matrix4 {
  const [w, x, y, z] = body.quaternion
  return basis.clone().multiply(new THREE.Matrix4().compose(
    new THREE.Vector3(...body.position), new THREE.Quaternion(x, y, z, w), new THREE.Vector3(1, 1, 1),
  ))
}

/** Optical frames share Blender/Three's -Z viewing axis and +Y image up. */
export function applyOpticalFrame(camera: THREE.Camera, body: BodyTransform) {
  nativeFrameMatrix(body).decompose(camera.position, camera.quaternion, camera.scale)
  camera.up.set(0, 1, 0).applyQuaternion(camera.quaternion)
  camera.updateMatrixWorld()
}

const movingLinks: Record<string, string> = {
  SO101_Link_shoulder_link: 'shoulder_pan_link',
  SO101_Link_upper_arm_link: 'shoulder_lift_link',
  SO101_Link_lower_arm_link: 'elbow_link',
  SO101_Link_wrist_link: 'wrist_flex_link',
  SO101_Link_gripper_link: 'wrist_roll_link',
  SO101_Link_moving_jaw_so101_v1_link: 'gripper_link',
  SO101_Mount: 'arm_mount',
  CTRL_Lift_Carriage: 'lift_carriage',
}

export function rigidBodyFor(node: THREE.Object3D): string {
  let ancestor: THREE.Object3D | null = node
  while (ancestor) {
    const wheel = /^(?:Wheel_4in_LeKiwi|Bearing_Wheel_Coupler|Servo_Wheel_Coupler)_([123])$/.exec(ancestor.name)
    if (wheel) return `wheel_${wheel[1]}_body`
    const body = movingLinks[ancestor.name]
    if (body) return body
    ancestor = ancestor.parent
  }
  // Blender's base parts are siblings of CTRL_Robot_Root, not its children.
  // All remaining robot meshes are rigid chassis parts, including the spine.
  return 'chassis'
}

/** Bake only visual offsets, once, using the exact authored reference pose. */
export function buildRigidAssembly(source: THREE.Object3D, binding: AssemblyBinding, replaceWrist = false) {
  source.updateMatrixWorld(true)
  const group = new THREE.Group()
  const anchors = new Map<string, THREE.Group>()
  const rest = new Map(binding.referenceBodies.map((body) => [body.name, bodyMatrix(body)]))
  const sourceConversion = new THREE.Matrix4().set(...binding.sourceToSimulation.flat() as Parameters<THREE.Matrix4['set']>)
  const gltfToScene = basis.clone().multiply(sourceConversion).multiply(inverseBasis)
  source.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return
    if (replaceWrist && node.name.startsWith('SO101_gripper_link_wrist_roll_follower_so101_v1_02')) return
    const name = rigidBodyFor(node)
    const reference = rest.get(name)
    if (!reference) throw new Error(`Missing reference transform for ${name}`)
    let anchor = anchors.get(name)
    if (!anchor) {
      anchor = new THREE.Group()
      anchor.name = name
      anchor.matrixAutoUpdate = false
      anchor.matrix.copy(reference)
      anchors.set(name, anchor)
      group.add(anchor)
    }
    const mesh = node.clone(false)
    mesh.userData.sourceNodeId = node.uuid
    mesh.matrixAutoUpdate = false
    mesh.matrix.copy(reference.clone().invert().multiply(gltfToScene).multiply(node.matrixWorld))
    mesh.castShadow = true
    mesh.receiveShadow = true
    anchor.add(mesh)
  })
  group.updateMatrixWorld(true)
  return { group, anchors }
}

export function applyBodyTransforms(anchors: Map<string, THREE.Group>, bodies: BodyTransform[]) {
  for (const body of bodies) {
    const anchor = anchors.get(body.name)
    if (!anchor) continue
    anchor.matrix.copy(bodyMatrix(body))
    anchor.matrixWorldNeedsUpdate = true
  }
}
