import { Grid, OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Component, Suspense, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import * as THREE from 'three'
import type { CameraMode, SimulationSnapshot, SimulationStatus } from '../physics/protocol'
import { applyBodyTransforms, applyOpticalFrame, buildRigidAssembly } from '../robot/assembly'
import { CameraAssets } from './CameraAssets'
import rig from '../../public/robot/camera-rig.json'
import binding from '../../public/robot/assembly-binding.json'

const CAMERA_OPTIONS = { position: [1.6, 1.25, -1.6] as [number, number, number], fov: 42, near: 0.01, far: 50 }

interface RobotSceneProps {
  snapshot: SimulationSnapshot | null
  status: SimulationStatus
  cameraMode: CameraMode
  collisionDebug: boolean
  visualAssetUrl: string | null
  onFocus: () => void
}

class AssetBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function PlaceholderRobot({ status }: { status: SimulationStatus }) {
  const accent = status === 'error' ? '#ef5b48' : '#e3f05a'
  return (
    <group position={[0, 0.18, 0]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.35, 0.12, 8]} />
        <meshStandardMaterial color="#22272c" metalness={0.65} roughness={0.32} />
      </mesh>
      {[0, 1, 2].map((index) => {
        const angle = index * Math.PI * 2 / 3
        return (
          <mesh key={index} position={[Math.cos(angle) * 0.32, -0.015, Math.sin(angle) * 0.32]} rotation={[Math.PI / 2, angle, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.055, 0.045, 18]} />
            <meshStandardMaterial color="#101316" roughness={0.68} />
          </mesh>
        )
      })}
      <mesh position={[0, 0.55, 0.08]} castShadow>
        <boxGeometry args={[0.07, 1, 0.07]} />
        <meshStandardMaterial color="#778189" metalness={0.75} roughness={0.25} />
      </mesh>
      <mesh position={[0.04, 0.55, -0.005]} castShadow>
        <boxGeometry args={[0.13, 0.09, 0.12]} />
        <meshStandardMaterial color={accent} roughness={0.4} />
      </mesh>
      <group position={[0.1, 0.58, 0]} rotation={[0, 0, -0.35]}>
        <mesh position={[0.16, 0, 0]} castShadow>
          <boxGeometry args={[0.32, 0.075, 0.09]} />
          <meshStandardMaterial color="#d7dbd7" metalness={0.2} roughness={0.5} />
        </mesh>
        <mesh position={[0.34, -0.08, 0]} rotation={[0, 0, -0.6]} castShadow>
          <boxGeometry args={[0.24, 0.065, 0.075]} />
          <meshStandardMaterial color="#c8cdca" metalness={0.2} roughness={0.5} />
        </mesh>
      </group>
    </group>
  )
}

export function RobotAssembly({ url, snapshot }: { url: string; snapshot: SimulationSnapshot | null }) {
  const source = useGLTF(url)
  const assembly = useMemo(() => buildRigidAssembly(source.scene, binding as Parameters<typeof buildRigidAssembly>[1], true), [source.scene])
  useFrame(() => {
    if (snapshot) applyBodyTransforms(assembly.anchors, snapshot.bodies)
  })
  return <primitive object={assembly.group} />
}

function CameraController({ mode, snapshot }: { mode: CameraMode; snapshot: SimulationSnapshot | null }) {
  const { camera } = useThree()
  const desired = useRef(new THREE.Vector3())
  const lookTarget = useRef(new THREE.Vector3())
  const base = snapshot?.robot.base.position ?? [0, 0, 0]

  useEffect(() => {
    camera.up.set(0, 1, 0)
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = mode === 'wrist' ? rig.wrist.verticalFovDegrees : mode === 'top' ? rig.mast.verticalFovDegrees : 42
      camera.near = mode === 'wrist' || mode === 'top' ? 0.001 : 0.01
      camera.updateProjectionMatrix()
    }
    if (mode === 'orbit') {
      camera.position.set(base[0] + 1.6, 1.25, -base[1] - 1.6)
      camera.lookAt(base[0], 0.55, -base[1])
    }
  // Only a camera-mode change may reposition the orbit camera.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, camera])

  useFrame((_state, delta) => {
    const arm = snapshot?.bodies.find((body) => body.name === 'arm_mount')
    const wristOptical = snapshot?.bodies.find((body) => body.name === 'wrist_camera_optical')
    if (mode === 'wrist' && wristOptical) {
      applyOpticalFrame(camera, wristOptical)
      return
    }
    const spineOptical = snapshot?.bodies.find((body) => body.name === 'spine_camera_18in_optical')
    if (mode === 'top' && spineOptical) {
      applyOpticalFrame(camera, spineOptical)
      return
    }
    const target = mode === 'arm' && arm
      ? lookTarget.current.set(arm.position[0], arm.position[2], -arm.position[1])
      : lookTarget.current.set(base[0], 0.55, -base[1])
    if (mode === 'orbit') return
    if (mode === 'follow') desired.current.set(target.x + 1.45, target.y + 0.85, target.z + 1.45)
    if (mode === 'arm') desired.current.set(target.x + 0.75, target.y + 0.22, target.z + 0.72)
    camera.position.lerp(desired.current, Math.min(1, delta * 4.5))
    camera.lookAt(target)
  })
  return null
}

export function Workshop({ collisionDebug }: { collisionDebug: boolean }) {
  return (
    <>
      <color attach="background" args={['#111517']} />
      <fog attach="fog" args={['#111517', 5, 12]} />
      <ambientLight intensity={0.82} />
      <directionalLight position={[3, 6, 4]} intensity={2.5} castShadow shadow-mapSize={[2048, 2048]} />
      <spotLight position={[-2, 3, -2]} angle={0.55} penumbra={0.7} intensity={8} color="#dce7cf" />
      <Grid
        args={[12, 12]}
        cellSize={0.25}
        cellThickness={0.65}
        cellColor="#384044"
        sectionSize={1}
        sectionThickness={1.2}
        sectionColor="#586267"
        fadeDistance={9}
        fadeStrength={1.5}
        infiniteGrid
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#111517" roughness={0.95} />
      </mesh>
    </>
  )
}

export function RobotScene({ snapshot, status, cameraMode, collisionDebug, visualAssetUrl, onFocus }: RobotSceneProps) {
  return (
    <div className="scene-shell" onPointerDown={onFocus}>
      <Canvas
        shadows
        camera={CAMERA_OPTIONS}
        dpr={[1, 1.7]}
        fallback={<div className="canvas-unavailable"><strong>3D renderer unavailable</strong><span>WebGL could not start in this browser session.</span></div>}
      >
        <Workshop collisionDebug={collisionDebug} />
        <CameraController mode={cameraMode} snapshot={snapshot} />
        {cameraMode === 'orbit' && <OrbitCamera snapshot={snapshot} />}
        <Suspense fallback={<PlaceholderRobot status="loading" />}>
          <AssetBoundary fallback={<PlaceholderRobot status="error" />}>
            {visualAssetUrl && status !== 'error'
              ? <><RobotAssembly url={visualAssetUrl} snapshot={snapshot} /><CameraAssets snapshot={snapshot} /></>
              : <PlaceholderRobot status={status} />}
          </AssetBoundary>
        </Suspense>
      </Canvas>
      <div className="scene-reticle" aria-hidden="true"><span /><span /></div>
      <div className="axis-chip" aria-label="Robot coordinates: X forward, Y left, Z up"><i className="axis-x" />X forward <i className="axis-y" />Y left <i className="axis-z" />Z up</div>
    </div>
  )
}

function OrbitCamera({ snapshot }: { snapshot: SimulationSnapshot | null }) {
  const target = useRef<[number, number, number]>([snapshot?.robot.base.position[0] ?? 0, 0.55, -(snapshot?.robot.base.position[1] ?? 0)])
  return <OrbitControls makeDefault target={target.current} minDistance={0.35} maxDistance={7} maxPolarAngle={Math.PI * 0.49} enableDamping dampingFactor={0.12} />
}
