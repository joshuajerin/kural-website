import { readFileSync, writeFileSync } from 'node:fs'
import loadMujoco, { type MainModule, type MjData, type MjModel } from '@mujoco/mujoco'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_CONTROL_CONFIG as config, DEFAULT_NEUTRAL_JOINTS as home, GESTURES, STOW_JOINTS } from '../src/control'
import { gestureSegmentDuration } from '../src/control/gestures'
import { JOINT_NAMES, type JointName } from '../src/types'

let mj: MainModule, model: MjModel
const report: Record<string, unknown> = {}
beforeAll(async () => {
  mj = await loadMujoco()
  mj.FS.writeFile('/kural.xml', readFileSync(new URL('../public/robot/scene/kural.xml', import.meta.url), 'utf8'))
  model = mj.MjModel.from_xml_path('/kural.xml')
})
afterAll(() => {
  model?.delete()
  writeFileSync(new URL('./generated/gesture-calibration.json', import.meta.url), JSON.stringify(report, null, 2))
})
function setPose(d: MjData, pose: Record<string, number>) {
  for (const [name, value] of Object.entries(pose)) {
    const j = d.jnt(name); j.qpos[0] = value; j.delete()
  }
  mj.mj_forward(model, d)
}
function direction(d: MjData) {
  const b = d.site('tool_frame'), chassis = d.body('chassis')
  try {
    const a = Array.from(b.xmat as ArrayLike<number>, Number), c = Array.from(chassis.xmat as ArrayLike<number>, Number)
    const world = [a[2], a[5], a[8]]
    return [0, 1, 2].map(i => world[0] * c[i] + world[1] * c[3 + i] + world[2] * c[6 + i])
  } finally { b.delete(); chassis.delete() }
}

describe('forward gesture paths in the mounted SO101 frame', () => {
  it.each(['wave', 'point', 'inspect'] as const)('%s faces chassis forward and slightly up, including every wave segment', id => {
    const d = new mj.MjData(model)
    let from = { ...home }, minForward = 1, minUp = 1
    try {
      setPose(d, { lift: .43 })
      for (const [index, frame] of GESTURES[id].keyframes.entries()) {
        const to = { ...from, ...frame.targets }
        for (let sample = index === 0 ? 40 : 0; sample <= 40; sample++) {
          const pose = Object.fromEntries(JOINT_NAMES.map(n => [n, from[n] + (to[n] - from[n]) * sample / 40]))
          setPose(d, pose)
          const forward = direction(d)
          minForward = Math.min(minForward, forward[0]); minUp = Math.min(minUp, forward[2])
          expect(forward[0]).toBeGreaterThan(.99)
          expect(forward[2]).toBeGreaterThan(.05)
          expect(forward[2]).toBeLessThan(.12)
        }
        const duration = gestureSegmentDuration(from, frame, config) / 1000
        for (const name of JOINT_NAMES) {
          const distance = Math.abs(to[name] - from[name])
          expect(1.5 * distance / duration).toBeLessThanOrEqual(config.joints[name].maxVelocity + 1e-9)
          expect(6 * distance / duration ** 2).toBeLessThanOrEqual(config.joints[name].maxAcceleration + 1e-9)
        }
        from = to
      }
      report[id] = { minForward, minUp }
    } finally { d.delete() }
  })
  it.each(['wave', 'point', 'inspect'] as const)('%s runs through actual servos without arm/rail penetration and settles forward', id => {
    const d = new mj.MjData(model)
    const actuators = Object.fromEntries([...JOINT_NAMES, 'lift'].map(name => {
      const a = model.actuator(name + '_motor'); const index = a.id; a.delete(); return [name, index]
    }))
    const geomNames = Array.from({ length: model.ngeom }, (_, i) => {
      const g = model.geom(i), name = g.name; g.delete(); return name
    })
    try {
      setPose(d, { ...home, lift: .43 })
      d.ctrl[actuators.lift] = .43
      for (const n of JOINT_NAMES) d.ctrl[actuators[n]] = home[n]
      for (let i = 0; i < 500; i++) mj.mj_step(model, d)
      let from = { ...home }, worstPenetration = 0
      for (const frame of GESTURES[id].keyframes) {
        const to = { ...from, ...frame.targets }, seconds = gestureSegmentDuration(from, frame, config) / 1000
        for (let step = 0; step <= Math.ceil(seconds * 500); step++) {
          const t = Math.min(1, step / (seconds * 500)), s = t * t * (3 - 2 * t)
          for (const n of JOINT_NAMES) d.ctrl[actuators[n]] = from[n] + (to[n] - from[n]) * s
          mj.mj_step(model, d)
          for (let i = 0; i < d.ncon; i++) {
            const c = d.contact.get(i)!
            const names = [geomNames[c.geom1], geomNames[c.geom2]]
            if (!names.some(n => n.includes('roller'))) worstPenetration = Math.min(worstPenetration, c.dist)
            c.delete()
          }
          expect(Array.from(d.qpos).every(Number.isFinite)).toBe(true)
        }
        from = to
      }
      for (let i = 0; i < 500; i++) mj.mj_step(model, d)
      expect(worstPenetration).toBeGreaterThan(-.001)
      expect(direction(d)[0]).toBeGreaterThan(.99)
      expect(direction(d)[2]).toBeGreaterThan(.04)
      for (const n of JOINT_NAMES) {
        const j = d.jnt(n); expect(Math.abs(j.qpos[0] - from[n as JointName])).toBeLessThan(.035); j.delete()
      }
      report[id + 'Dynamics'] = { worstPenetrationM: worstPenetration, finalForward: direction(d) }
    } finally { d.delete() }
  })
  it('uses the requested global SO-101 neutral pose for home and stow', () => {
    expect(GESTURES.home.keyframes[0].targets).toEqual(home)
    expect(GESTURES.stow.keyframes[0].targets).toEqual(STOW_JOINTS)
    expect(STOW_JOINTS.shoulder_pan * 180 / Math.PI).toBeCloseTo(0, 6)
    expect(STOW_JOINTS.shoulder_lift * 180 / Math.PI).toBeCloseTo(-99.4, 6)
    expect(STOW_JOINTS.elbow_flex * 180 / Math.PI).toBeCloseTo(79.1, 6)
    expect(STOW_JOINTS.wrist_flex * 180 / Math.PI).toBeCloseTo(65.1, 6)
    expect(STOW_JOINTS.wrist_roll * 180 / Math.PI).toBeCloseTo(90.3, 6)
    expect(STOW_JOINTS.gripper * 180 / Math.PI).toBeCloseTo(-10, 6)
  })
})
