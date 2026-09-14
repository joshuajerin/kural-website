import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { bodyMatrix } from '../robot/assembly'
import { simulatorAsset } from '../robot/paths'
import type { SimulationSnapshot } from '../physics/protocol'
import rig from '../../public/robot/camera-rig.json'

function MountedAsset({ kind, snapshot }: { kind: 'wrist' | 'mast'; snapshot: SimulationSnapshot | null }) {
  const spec = rig[kind]
  const source = useGLTF(simulatorAsset(`robot/assets/${spec.asset}`))
  const group = useRef<THREE.Group>(null)
  const visual = useMemo(() => source.scene.clone(true), [source.scene])
  useFrame(() => {
    const parent = snapshot?.bodies.find(body => body.name === spec.parentBody)
    if (parent && group.current) {
      group.current.matrix.copy(bodyMatrix(parent))
      group.current.matrixWorldNeedsUpdate = true
      group.current.visible = true
    }
  })
  return <group ref={group} matrixAutoUpdate={false} visible={false}><primitive object={visual} /></group>
}

export function CameraAssets({ snapshot }: { snapshot: SimulationSnapshot | null }) {
  return <><MountedAsset kind="wrist" snapshot={snapshot} /><MountedAsset kind="mast" snapshot={snapshot} /></>
}
