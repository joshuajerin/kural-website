import { readFileSync, writeFileSync } from 'node:fs'
import loadMujoco, { type MainModule, type MjModel, type MjData } from '@mujoco/mujoco'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { calculateOmniWheelTargets, DEFAULT_CONTROL_CONFIG } from '../src/control'
import { HeadingController, quaternionYaw, SIMULATION_WHEEL_ACTUATORS } from '../src/control/heading'
import type { ChassisVelocity } from '../src/control/kinematics'
import binding from '../public/robot/assembly-binding.json'

let mj: MainModule, model: MjModel
const stabilityReport: Record<string, { heightRangeMm: number; maxTiltDegrees: number; maxVerticalSpeed: number }> = {}
beforeAll(async () => {
  mj = await loadMujoco()
  mj.FS.writeFile('/kural.xml', readFileSync(new URL('../public/robot/scene/kural.xml', import.meta.url), 'utf8'))
  model = mj.MjModel.from_xml_path('/kural.xml')
})
afterAll(() => {
  model?.delete()
  writeFileSync(new URL('./generated/driving-stability.json', import.meta.url), JSON.stringify({ modelRevision: DEFAULT_CONTROL_CONFIG.modelRevision, mujocoVersion: '3.11.0', samplesPerSecond: 500, traces: stabilityReport }, null, 2) + '\n')
})

function pose(d: MjData) {
  const b = d.body('chassis')
  try { return { p: Array.from(b.xpos) as number[], q: Array.from(b.xquat) as number[] } } finally { b.delete() }
}
function setJoint(d: MjData, name: string, value: number) {
  const j = d.jnt(name), a = model.actuator(`${name}_motor`)
  try { j.qpos[0] = value; d.ctrl[a.id] = value } finally { j.delete(); a.delete() }
}
function initial() {
  const d = new mj.MjData(model)
  for (const [name, value] of Object.entries({ ...binding.homeJoints, lift: 0.43 })) setJoint(d, name, value)
  mj.mj_forward(model, d)
  return d
}
function steps(d: MjData, seconds: number) { for (let i = 0; i < seconds * 500; i++) mj.mj_step(model, d) }

function stabilityTrace(d: MjData) {
  const body = model.body('chassis'), id = body.id
  body.delete()
  let minHeight = Infinity, maxHeight = -Infinity, maxTilt = 0, maxVerticalSpeed = 0
  const base = model.jnt('base_free'), dof = model.jnt_dofadr[base.id]
  base.delete()
  return {
    step() {
      mj.mj_step(model, d)
      const z = d.xpos[id * 3 + 2]
      minHeight = Math.min(minHeight, z); maxHeight = Math.max(maxHeight, z)
      maxTilt = Math.max(maxTilt, Math.acos(Math.max(-1, Math.min(1, d.xmat[id * 9 + 8]))))
      maxVerticalSpeed = Math.max(maxVerticalSpeed, Math.abs(d.qvel[dof + 2]))
    },
    assertStable(label: string) {
      const measured = { heightRangeMm: (maxHeight - minHeight) * 1000, maxTiltDegrees: maxTilt * 180 / Math.PI, maxVerticalSpeed }
      stabilityReport[label] = measured
      // Sample every physics step: endpoint-only direction checks missed rocking.
      expect(measured.heightRangeMm, label).toBeLessThan(0.5)
      expect(measured.maxTiltDegrees, label).toBeLessThan(0.5)
      expect(measured.maxVerticalSpeed, label).toBeLessThan(0.04)
    },
  }
}

describe('actual MuJoCo 3.11 full robot physics', () => {
  it('starts at source mounts without floor penetration and holds lift', () => {
    const d = initial()
    try {
      const b = d.body('lift_carriage')
      const ref = binding.referenceBodies.find(b => b.name === 'lift_carriage')!
      expect(Array.from(b.xpos)).toEqual(ref.position.map(v => expect.closeTo(v, 7)))
      b.delete()
      steps(d, 10)
      expect(pose(d).p[2]).toBeGreaterThan(0.045)
      expect(pose(d).q[0]).toBeGreaterThan(0.99)
      const lift = d.jnt('lift')
      expect(lift.qpos[0]).toBeCloseTo(0.43, 3)
      lift.delete()
    } finally { d.delete() }
  })

  const scenarios: [string, ChassisVelocity, number, number][] = [
    ['W', { vx: 0.2, vy: 0, yawRate: 0 }, 0, 1],
    ['S', { vx: -0.2, vy: 0, yawRate: 0 }, 0, -1],
    ['A', { vx: 0, vy: 0.2, yawRate: 0 }, 1, 1],
    ['D', { vx: 0, vy: -0.2, yawRate: 0 }, 1, -1],
    ['ArrowLeft', { vx: 0, vy: 0, yawRate: 0.7 }, 2, 1],
    ['ArrowRight', { vx: 0, vy: 0, yawRate: -0.7 }, 2, -1],
  ]
  it.each(scenarios)('%s moves through wheel contact in the intended direction', (_key, command, axis, sign) => {
    const d = initial(), heading = new HeadingController()
    try {
      steps(d, 2)
      const start = pose(d)
      const trace = stabilityTrace(d)
      const wheelValues: Record<string, number> = {}
      for (let frame = 0; frame < 200; frame++) {
        const corrected = heading.update(command, quaternionYaw(pose(d).q), 0.02)
        const targets = calculateOmniWheelTargets(corrected, DEFAULT_CONTROL_CONFIG).wheelVelocities
        for (const [name, value] of Object.entries(targets)) {
          const current = wheelValues[name] ?? 0
          const maxDelta = DEFAULT_CONTROL_CONFIG.maxWheelAcceleration * 0.02
          wheelValues[name] = current + Math.max(-maxDelta, Math.min(maxDelta, value - current))
          const actuator = model.actuator(SIMULATION_WHEEL_ACTUATORS[name])
          d.ctrl[actuator.id] = wheelValues[name]
          actuator.delete()
        }
        for (let step = 0; step < 10; step++) trace.step()
      }
      const end = pose(d), delta = end.p.map((v, i) => v - start.p[i])
      const yaw = quaternionYaw(end.q) - quaternionYaw(start.q)
      if (axis < 2) {
        expect(delta[axis] * sign).toBeGreaterThan(0.15)
        expect(Math.abs(delta[1 - axis])).toBeLessThan(0.035)
        expect(Math.abs(yaw)).toBeLessThan(0.15)
      } else {
        expect(yaw * sign).toBeGreaterThan(1.2)
        expect(Math.hypot(delta[0], delta[1])).toBeLessThan(0.02)
      }
      expect(end.p[2]).toBeGreaterThan(0.045)
      trace.assertStable(_key)
      for (const [name, value] of Object.entries(binding.homeJoints)) {
        const j = d.jnt(name)
        expect(Math.abs(j.qpos[0] - value)).toBeLessThan(0.035)
        j.delete()
      }
    } finally { d.delete() }
  })

  it.each([0.43, 0.86])('stays level through repeated full-speed reversals and mixed motion at lift %s m', (height) => {
    const d = initial(), heading = new HeadingController()
    try {
      setJoint(d, 'lift', height)
      mj.mj_forward(model, d)
      steps(d, 2)
      const trace = stabilityTrace(d), wheelValues: Record<string, number> = {}
      const diagonal = 0.2 / Math.sqrt(2)
      const commands: ChassisVelocity[] = [
        { vx: 0.2, vy: 0, yawRate: 0 }, { vx: -0.2, vy: 0, yawRate: 0 },
        { vx: 0, vy: 0.2, yawRate: 0 }, { vx: 0, vy: -0.2, yawRate: 0 },
        { vx: diagonal, vy: diagonal, yawRate: 0 }, { vx: -diagonal, vy: -diagonal, yawRate: 0 },
        { vx: 0, vy: 0, yawRate: 0.7 }, { vx: 0, vy: 0, yawRate: -0.7 },
        { vx: diagonal, vy: diagonal, yawRate: 0.5 }, { vx: -diagonal, vy: -diagonal, yawRate: -0.5 },
        { vx: 0, vy: 0, yawRate: 0 },
      ]
      for (let frame = 0; frame < 1100; frame++) {
        const command = commands[Math.floor(frame / 50) % commands.length]
        const targets = calculateOmniWheelTargets(heading.update(command, quaternionYaw(pose(d).q), 0.02), DEFAULT_CONTROL_CONFIG).wheelVelocities
        for (const [name, target] of Object.entries(targets)) {
          const current = wheelValues[name] ?? 0
          const maxDelta = DEFAULT_CONTROL_CONFIG.maxWheelAcceleration * 0.02
          wheelValues[name] = current + Math.max(-maxDelta, Math.min(maxDelta, target - current))
          const actuator = model.actuator(SIMULATION_WHEEL_ACTUATORS[name])
          d.ctrl[actuator.id] = wheelValues[name]; actuator.delete()
        }
        for (let step = 0; step < 10; step++) trace.step()
      }
      trace.assertStable(`mixed_${height}m`)
    } finally { d.delete() }
  }, 30000)

  it('up/down lift travel is upward/downward in world Z and leaves chassis-mounted spine fixed', () => {
    const d = initial()
    try {
      const positions: number[] = []
      for (const height of [0.43, 0.53, 0.33]) {
        setJoint(d, 'lift', height)
        mj.mj_forward(model, d)
        const b = d.body('lift_carriage')
        positions.push(b.xpos[2]); b.delete()
        expect(pose(d).p).toEqual([0, 0, 0.0508])
      }
      expect(positions[1] - positions[0]).toBeCloseTo(0.1, 8)
      expect(positions[2] - positions[0]).toBeCloseTo(-0.1, 8)
    } finally { d.delete() }
  })
})
