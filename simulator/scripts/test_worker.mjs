// Exercise the real module-worker source without creating any browser window.
import { build } from 'esbuild'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = new URL('../', import.meta.url)
const temporary = new URL('../.worker-check/', import.meta.url)
await mkdir(temporary, { recursive: true })
await build({
  entryPoints: [fileURLToPath(new URL('src/physics/simulation.worker.ts', root))],
  outfile: fileURLToPath(new URL('physics.mjs', temporary)),
  bundle: true, platform: 'node', format: 'esm', packages: 'external',
  plugins: [{ name: 'local-wasm', setup(build) {
    build.onResolve({ filter: /mujoco\.wasm\?url$/ }, () => ({ path: 'wasm', namespace: 'local' }))
    build.onLoad({ filter: /.*/, namespace: 'local' }, () => ({ contents: `export default ${JSON.stringify(fileURLToPath(new URL('node_modules/@mujoco/mujoco/mujoco.wasm', root)))}` }))
  } }],
})
await writeFile(new URL('entry.mjs', temporary), `
import { parentPort } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
globalThis.self = globalThis;
self.location = { href: 'http://localhost/' };
self.postMessage = message => parentPort.postMessage(message);
self.close = () => process.exit(0);
globalThis.fetch = async url => new Response(await readFile(new URL('public/' + String(url).replace(/^\\//, ''), ${JSON.stringify(root.href)})));
await import('./physics.mjs');
parentPort.on('message', data => self.onmessage({ data }));
`)
const worker = new Worker(new URL('entry.mjs', temporary))
let snapshot, ready = false, fault = null, sequence = 0
worker.on('message', message => {
  if (message.type === 'ready') ready = true
  if (message.type === 'snapshot') snapshot = message.snapshot
  if (message.type === 'error') fault = message
})
worker.on('error', error => { fault = error })
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function waitFor(predicate, timeout = 5000) {
  const start = Date.now()
  while (!predicate()) {
    if (fault) throw new Error(JSON.stringify(fault))
    assert(Date.now() - start < timeout, 'Worker response timed out')
    await sleep(10)
  }
}
function send(payload, expiry = Date.now() + 250) {
  worker.postMessage({ type: 'command', command: { ...payload, sequence: sequence++, sessionId: 'worker-regression', configRevision: 'kural-control-v9', issuedAtMs: Date.now(), expiresAtMs: expiry } })
}
const result = {}
try {
  worker.postMessage({ type: 'initialize', modelUrl: '/robot/scene/kural.xml' })
  await waitFor(() => ready && snapshot)
  assert(Math.abs(snapshot.robot.lift.value - 0.43) < 0.001)
  result.startup = 'authored 430 mm lift and arm servo targets applied before stepping'
  send({ kind: 'drive', vx: 0.2, vy: 0, yawRate: 0 }, Date.now() - 10)
  await sleep(100)
  assert(Object.values(snapshot.targets.wheelVelocities).every(v => v === 0))
  result.expiredPacket = 'rejected across main/worker epoch clocks'
  const start = snapshot.robot.base.position[0]
  for (let i = 0; i < 15; i++) {
    send({ kind: 'drive', vx: 0.15, vy: 0, yawRate: 0 })
    send({ kind: 'moveLift', velocity: 0 })
    send({ kind: 'jogJoint', joint: 'shoulder_pan', velocity: 0 })
    await sleep(100)
  }
  assert(snapshot.robot.base.position[0] > start + 0.05)
  assert(Math.abs(snapshot.robot.lift.value - 0.43) < 0.01)
  result.forwardDisplacementM = snapshot.robot.base.position[0] - start
  await sleep(1000)
  assert(Object.values(snapshot.targets.wheelVelocities).every(v => Math.abs(v) < 1e-6))
  result.heartbeatExpiry = 'wheel targets decelerated to zero without renewal'
  send({ kind: 'playGesture', gesture: 'wave' })
  await waitFor(() => snapshot.targets.activeGesture === 'wave')
  send({ kind: 'drive', vx: 0, vy: 0, yawRate: 0 })
  send({ kind: 'moveLift', velocity: 0 })
  send({ kind: 'jogJoint', joint: 'shoulder_pan', velocity: 0 })
  await sleep(100)
  assert.equal(snapshot.targets.activeGesture, 'wave')
  send({ kind: 'drive', vx: 0, vy: 0, yawRate: 0.4 })
  await waitFor(() => snapshot.targets.activeGesture === null)
  result.gestureInterruption = 'zero input preserves gesture; manual chassis rotation cancels it'
  send({ kind: 'stop' })
  worker.postMessage({ type: 'reset' })
  await sleep(100)
  assert(Math.abs(snapshot.robot.lift.value - 0.43) < 0.001)
  send({ kind: 'moveLift', velocity: 0.08 })
  for (let i = 0; i < 8; i++) { send({ kind: 'moveLift', velocity: 0.08 }); await sleep(100) }
  assert(snapshot.robot.lift.value > 0.46)
  send({ kind: 'stop' })
  await waitFor(() => snapshot.targets.liftVelocity === 0)
  const held = snapshot.targets.liftPosition
  await sleep(300)
  assert.equal(snapshot.targets.liftPosition, held)
  result.liftAndStop = 'upward travel and held carriage after stop'
  worker.postMessage({ type: 'pause', paused: true })
  await waitFor(() => snapshot.robot.paused)
  const pausedPose = snapshot.robot.base.position
  await sleep(200)
  assert.deepEqual(snapshot.robot.base.position, pausedPose)
  result.pause = 'physics stationary'
  console.log(JSON.stringify(result, null, 2))
  await writeFile(new URL('tests/generated/worker-regression.json', root), JSON.stringify(result, null, 2) + '\n')
} finally {
  await worker.terminate()
  await rm(temporary, { recursive: true, force: true })
}
