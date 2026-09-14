// Read evaluated GLB vertices. Imported object origins are NOT wheel centers.
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const robot = new URL('../public/robot/', import.meta.url)
const bytes = Buffer.concat(await Promise.all(['00', '01', '02'].map((part) =>
  readFile(new URL(`assets/kural-assembly-v1.glb.part-${part}`, robot)),
)))
const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
scene.updateMatrixWorld(true)
const toBlender = new THREE.Matrix4().makeRotationX(Math.PI / 2)
const wheels = [1, 2, 3].map(index => {
  const node = scene.getObjectByName(`Wheel_4in_LeKiwi_${index}`)
  if (!node) throw new Error(`Missing wheel ${index}`)
  const bounds = new THREE.Box3(), vertex = new THREE.Vector3()
  const inverse = node.matrixWorld.clone().invert()
  node.traverse(mesh => {
    if (!mesh.isMesh) return
    const transform = inverse.clone().multiply(mesh.matrixWorld)
    const positions = mesh.geometry.attributes.position
    for (let i = 0; i < positions.count; i++) bounds.expandByPoint(vertex.fromBufferAttribute(positions, i).applyMatrix4(transform))
  })
  const size = bounds.getSize(new THREE.Vector3()).toArray()
  const axleIndex = size.indexOf(Math.min(...size))
  const localAxis = new THREE.Vector3().setComponent(axleIndex, 1)
  const toSource = toBlender.clone().multiply(node.matrixWorld)
  const center = bounds.getCenter(new THREE.Vector3()).applyMatrix4(toSource)
  const axis = localAxis.transformDirection(toSource)
  return { sourceIndex: index, centerSourceM: center.toArray(), axleSource: axis.toArray(), localBounds: { min: bounds.min.toArray(), max: bounds.max.toArray() } }
})
const centroid = new THREE.Vector3()
wheels.forEach(w => centroid.add(new THREE.Vector3(...w.centerSourceM).multiplyScalar(1 / 3)))
for (const wheel of wheels) {
  const direction = new THREE.Vector3(...wheel.centerSourceM).sub(centroid)
  const axis = new THREE.Vector3(...wheel.axleSource)
  if (axis.dot(direction) < 0) axis.negate()
  wheel.axleSource = axis.toArray()
}
await writeFile(new URL('wheel-geometry.json', robot), JSON.stringify({
  revision: 'kural-wheel-geometry-v3',
  sourceVisualSha256: createHash('sha256').update(bytes).digest('hex'),
  method: 'Evaluated vertex bounds in wheel-local coordinates; thin principal box axis is axle; outward sign; converted from glTF Y-up to source Blender Z-up.',
  wheels,
}, null, 2) + '\n')
console.log(wheels.map(({ sourceIndex, centerSourceM, axleSource }) => ({ sourceIndex, centerSourceM, axleSource })))
