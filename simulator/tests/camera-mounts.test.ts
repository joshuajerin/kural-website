import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import loadMujoco, { type MainModule, type MjData, type MjModel } from '@mujoco/mujoco'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { applyOpticalFrame } from '../src/robot/assembly'
import type { BodyTransform } from '../src/physics/protocol'
import rig from '../public/robot/camera-rig.json'
import binding from '../public/robot/assembly-binding.json'

let mj: MainModule, model: MjModel
beforeAll(async () => {
  mj = await loadMujoco()
  mj.FS.writeFile('/kural.xml', readFileSync(new URL('../public/robot/scene/kural.xml', import.meta.url), 'utf8'))
  model = mj.MjModel.from_xml_path('/kural.xml')
})
afterAll(() => model?.delete())
function body(data: MjData, name: string): BodyTransform {
  const b = data.body(name)
  try { return { name, position: Array.from(b.xpos), quaternion: Array.from(b.xquat) } as BodyTransform } finally { b.delete() }
}
function set(data: MjData, name: string, value: number) {
  const j = data.jnt(name)
  j.qpos[0] = value; j.delete()
}
function sourcePose(data: MjData) {
  for (const [name, value] of Object.entries({ ...binding.homeJoints, lift: 0.43 })) set(data, name, value)
  mj.mj_forward(model, data)
}

describe('source camera assemblies and optical coordinates', () => {
  it('ships the exact saved flat-hole 18 inch and SO101 integrated wrist STLs', () => {
    for (const [name, hash] of [
      ['Camera_mast_18in_flat_holes.stl', 'd5606574245910a81ff2871d206f13eca4109fee928d5a98495d133b4257db3e'],
      ['Wrist_Cam_Mount_32x32_UVC_Module_SO101.stl', 'b4345ccf23f1f2ed3f4885c205cac5afbed6ddd1b183617c4801751e3bafb7b4'],
    ]) {
      const bytes = readFileSync(new URL('../public/robot/assets/' + name, import.meta.url))
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash)
    }
    expect(rig.mast.sourceMeshCount).toBe(150)
  })
  it.each(['wrist', 'mast'] as const)('%s lens agrees with the saved assembly after the canonical frame conversion', key => {
    const d = new mj.MjData(model)
    try {
      sourcePose(d)
      const spec = rig[key], actual = body(d, spec.opticalBody)
      const c = new THREE.Matrix4().set(...binding.sourceToSimulation.flat() as Parameters<THREE.Matrix4['set']>)
      const source = new THREE.Matrix4().set(...spec.sourceWorldMatrix.flat() as Parameters<THREE.Matrix4['set']>)
      const expected = c.multiply(source)
      expect(new THREE.Vector3(...actual.position).distanceTo(new THREE.Vector3().setFromMatrixPosition(expected))).toBeLessThan(2e-6)
      const camera = new THREE.PerspectiveCamera()
      applyOpticalFrame(camera, actual)
      const basis = new THREE.Matrix4().makeRotationX(-Math.PI / 2)
      expected.premultiply(basis)
      const forward = new THREE.Vector3(0, 0, -1).transformDirection(expected)
      expect(camera.getWorldDirection(new THREE.Vector3()).distanceTo(forward)).toBeLessThan(2e-6)
      const up = new THREE.Vector3(0, 1, 0).transformDirection(expected)
      expect(camera.up.distanceTo(up)).toBeLessThan(2e-6)
    } finally { d.delete() }
  })
  it('moves the 457.2 mm mast with the carriage, with the saved 982 mm lens height and 65 degree pitch', () => {
    const d = new mj.MjData(model)
    try {
      sourcePose(d)
      const start = body(d, rig.mast.opticalBody)
      expect(start.position[2]).toBeCloseTo(0.982086 + binding.sourceToSimulation[2][3], 5)
      const camera = new THREE.PerspectiveCamera(); applyOpticalFrame(camera, start)
      expect(camera.getWorldDirection(new THREE.Vector3()).y).toBeCloseTo(-Math.sin(65 * Math.PI / 180), 5)
      const chassis = body(d, 'chassis')
      set(d, 'lift', .63); mj.mj_forward(model, d)
      expect(body(d, rig.mast.opticalBody).position[2] - start.position[2]).toBeCloseTo(.2, 6)
      expect(body(d, 'chassis').position).toEqual(chassis.position)
    } finally { d.delete() }
  })
  it('keeps the lens bolted to the wrist through roll, rather than to the tool tip or world', () => {
    const d = new mj.MjData(model)
    try {
      sourcePose(d)
      const start = body(d, rig.wrist.opticalBody)
      set(d, 'wrist_roll', 1); mj.mj_forward(model, d)
      expect(new THREE.Vector3(...body(d, rig.wrist.opticalBody).position).distanceTo(new THREE.Vector3(...start.position))).toBeGreaterThan(.01)
      const parent = model.body(rig.wrist.opticalBody), wrist = model.body('wrist_roll_link')
      expect(model.body_parentid[parent.id]).toBe(wrist.id)
      parent.delete(); wrist.delete()
    } finally { d.delete() }
  })
  it('has an upright wrist image at zero wrist roll in the forward pose', () => {
    const d = new mj.MjData(model)
    try {
      for (const [name, value] of Object.entries({ lift: .43, shoulder_pan: 0, shoulder_lift: -.7, elbow_flex: -.4, wrist_flex: -.55, wrist_roll: 0 })) set(d, name, value)
      mj.mj_forward(model, d)
      const camera = new THREE.PerspectiveCamera()
      applyOpticalFrame(camera, body(d, rig.wrist.opticalBody))
      expect(camera.up.y).toBeGreaterThan(.99)
      // The actual plate toes the lens inward 25 degrees toward the fingers.
      const tool = d.site('tool_frame')
      const a = Array.from(tool.xmat as ArrayLike<number>, Number)
      const pointing = new THREE.Vector3(a[2], a[8], -a[5])
      expect(camera.getWorldDirection(new THREE.Vector3()).dot(pointing)).toBeCloseTo(Math.cos(25 * Math.PI / 180), 4)
      tool.delete()
    } finally { d.delete() }
  })
})
