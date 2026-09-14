import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import binding from '../public/robot/assembly-binding.json'
import wheelGeometry from '../public/robot/wheel-geometry.json'
import { applyBodyTransforms, buildRigidAssembly, rigidBodyFor } from '../src/robot/assembly'
import type { BodyTransform } from '../src/physics/protocol'

let source: THREE.Group
const basis = new THREE.Matrix4().makeRotationX(-Math.PI / 2)
beforeAll(async () => {
  const bytes = Buffer.concat(['00', '01', '02'].map((part) => readFileSync(
    new URL(`../public/robot/assets/kural-assembly-v1.glb.part-${part}`, import.meta.url),
  )))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  source = gltf.scene
  source.updateMatrixWorld(true)
})

function maxError(a: THREE.Matrix4, b: THREE.Matrix4) {
  return Math.max(...a.elements.map((v, i) => Math.abs(v - b.elements[i])))
}

describe('complete Blender assembly attachment', () => {
  it('replaces exactly the fixed wrist follower when the integrated camera STL is installed', () => {
    const original = buildRigidAssembly(source, binding)
    const cameraAssembly = buildRigidAssembly(source, binding, true)
    const meshes = (group: THREE.Group) => {
      const result: THREE.Mesh[] = []
      group.traverse(node => { if (node instanceof THREE.Mesh) result.push(node) })
      return result
    }
    const before = meshes(original.group), after = meshes(cameraAssembly.group)
    expect(before.length - after.length).toBe(1)
    expect(after.some(node => node.name.startsWith('SO101_gripper_link_wrist_roll_follower_so101_v1_02'))).toBe(false)
    expect(cameraAssembly.anchors.get('gripper_link')!.children.length).toBe(original.anchors.get('gripper_link')!.children.length)
  })
  it('spins each wheel around its mesh-derived axle without moving its center or tilting its plane', () => {
    const assembly = buildRigidAssembly(source, binding)
    const c = new THREE.Matrix4().set(...binding.sourceToSimulation.flat() as Parameters<THREE.Matrix4['set']>)
    const conversion = basis.clone().multiply(c).multiply(basis.clone().invert())
    for (const geometry of wheelGeometry.wheels) {
      const node = source.getObjectByName(`Wheel_4in_LeKiwi_${geometry.sourceIndex}`)!
      const center = new THREE.Vector3(...geometry.centerSourceM).applyMatrix4(basis)
      const axis = new THREE.Vector3(...geometry.axleSource).transformDirection(basis)
      let original: THREE.Mesh | undefined
      node.traverse(n => { if (n instanceof THREE.Mesh && !original) original = n })
      const inverse = original!.matrixWorld.clone().invert()
      const localCenter = center.clone().applyMatrix4(inverse)
      const localAxleEnd = center.clone().add(axis).applyMatrix4(inverse)
      const wheelName = `wheel_${geometry.sourceIndex}_body`
      const drawn = assembly.anchors.get(wheelName)!.children.find(n => n.userData.sourceNodeId === original!.uuid)!
      const ref = binding.referenceBodies.find(b => b.name === wheelName)!
      const q0 = new THREE.Quaternion(ref.quaternion[1], ref.quaternion[2], ref.quaternion[3], ref.quaternion[0])
      const expectedCenter = center.clone().applyMatrix4(conversion)
      const expectedAxis = axis.clone().transformDirection(conversion)
      let maxVertexMovement = 0
      const point = new THREE.Vector3().fromBufferAttribute(original!.geometry.attributes.position, 0)
      const initialPoint = point.clone().applyMatrix4(drawn.matrixWorld)
      for (const angle of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, 2 * Math.PI]) {
        const q = q0.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle))
        applyBodyTransforms(assembly.anchors, [{ name: wheelName, position: ref.position, quaternion: [q.w, q.x, q.y, q.z] } as BodyTransform])
        assembly.group.updateMatrixWorld(true)
        const actualCenter = localCenter.clone().applyMatrix4(drawn.matrixWorld)
        const actualAxis = localAxleEnd.clone().applyMatrix4(drawn.matrixWorld).sub(actualCenter).normalize()
        expect(actualCenter.distanceTo(expectedCenter)).toBeLessThan(1e-7)
        expect(actualAxis.distanceTo(expectedAxis)).toBeLessThan(1e-6)
        maxVertexMovement = Math.max(maxVertexMovement, point.clone().applyMatrix4(drawn.matrixWorld).distanceTo(initialPoint))
      }
      expect(maxVertexMovement).toBeGreaterThan(0.03)
      expect(rigidBodyFor(source.getObjectByName(`STS3215_Motor_${geometry.sourceIndex}`)!)).toBe('chassis')
    }
  })
  it('preserves every exported mesh at the immutable authored pose', () => {
    const assembly = buildRigidAssembly(source, binding)
    const conversion = basis.clone().multiply(new THREE.Matrix4().set(...binding.sourceToSimulation.flat() as Parameters<THREE.Matrix4['set']>)).multiply(basis.clone().invert())
    const originals = new Map<string, THREE.Mesh>()
    source.traverse((node) => { if (node instanceof THREE.Mesh) originals.set(node.uuid, node) })
    let count = 0
    assembly.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return
      const original = originals.get(node.userData.sourceNodeId)!
      expect(maxError(node.matrixWorld, conversion.clone().multiply(original.matrixWorld))).toBeLessThan(1e-8)
      count++
    })
    expect(count).toBe(originals.size)
    expect(count).toBeGreaterThan(100)
  })

  it('attaches root-sibling base meshes and fixed spine to the same chassis', () => {
    expect(rigidBodyFor(source.getObjectByName('Kural_2040_Segment_1_500mm')!)).toBe('chassis')
    const assembly = buildRigidAssembly(source, binding)
    expect(assembly.anchors.get('chassis')!.children.length).toBeGreaterThan(50)
    for (const n of [1, 2, 3]) expect(rigidBodyFor(source.getObjectByName(`Wheel_4in_LeKiwi_${n}`)!)).toBe(`wheel_${n}_body`)
    const before = new Map<string, THREE.Matrix4>()
    assembly.group.traverse((n) => { if (n instanceof THREE.Mesh) before.set(n.uuid, n.matrixWorld.clone()) })
    const delta = new THREE.Matrix4().compose(new THREE.Vector3(0.75, -0.3, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.8), new THREE.Vector3(1, 1, 1))
    const bodies = binding.referenceBodies.map((body) => {
      const [w, x, y, z] = body.quaternion
      const pose = delta.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...body.position), new THREE.Quaternion(x, y, z, w), new THREE.Vector3(1, 1, 1)))
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3()
      pose.decompose(p, q, s)
      return { name: body.name, position: p.toArray(), quaternion: [q.w, q.x, q.y, q.z] } as BodyTransform
    })
    applyBodyTransforms(assembly.anchors, bodies)
    assembly.group.updateMatrixWorld(true)
    const renderedDelta = basis.clone().multiply(delta).multiply(basis.clone().invert())
    assembly.group.traverse((node) => {
      if (node instanceof THREE.Mesh) expect(maxError(node.matrixWorld, renderedDelta.clone().multiply(before.get(node.uuid)!))).toBeLessThan(1e-8)
    })
  })

  it('moving the carriage cannot move the fixed spine or base', () => {
    const assembly = buildRigidAssembly(source, binding)
    const fixed = assembly.anchors.get('chassis')!.matrix.clone()
    const carriage = binding.referenceBodies.find((b) => b.name === 'lift_carriage')!
    applyBodyTransforms(assembly.anchors, [{ ...carriage, position: [carriage.position[0], carriage.position[1], carriage.position[2] + 0.1] } as BodyTransform])
    expect(maxError(assembly.anchors.get('chassis')!.matrix, fixed)).toBe(0)
    expect(assembly.anchors.get('lift_carriage')!.matrix.elements[13]).toBeCloseTo(carriage.position[2] + 0.1, 8)
  })
})
