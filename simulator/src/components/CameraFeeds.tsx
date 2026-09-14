import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense } from 'react'
import type { SimulationSnapshot } from '../physics/protocol'
import { applyOpticalFrame } from '../robot/assembly'
import { RobotAssembly, Workshop } from './RobotScene'
import { CameraAssets } from './CameraAssets'
import rig from '../../public/robot/camera-rig.json'

interface CameraFeedsProps {
  snapshot: SimulationSnapshot | null
  visualAssetUrl: string | null
}

function FeedCamera({ type, snapshot }: { type: 'wrist' | 'mast'; snapshot: SimulationSnapshot | null }) {
  const { camera } = useThree()
  useFrame(() => {
    const optical = snapshot?.bodies.find(body => body.name === rig[type].opticalBody)
    if (optical) applyOpticalFrame(camera, optical)
  })
  return null
}

export function CameraFeeds({ snapshot, visualAssetUrl }: CameraFeedsProps) {
  return <section className="camera-feeds" aria-label="Simulated camera views">
    {(['wrist', 'mast'] as const).map(type => <section className="camera-feed" key={type} aria-label={`${type} camera`}>
      <div className="feed-label"><span>{type === 'wrist' ? 'Wrist · 32×32 UVC' : '18 in mast · Arducam B0261'}</span>
        <small>{type === 'wrist' ? 'SO-101 integrated mount · lens view' : 'carriage mounted · 65° down'}</small></div>
      <div className="feed-canvas">
        <Canvas dpr={[1, 1.25]} camera={{ fov: rig[type].verticalFovDegrees, near: 0.001, far: 20 }}>
          <Workshop collisionDebug={false} />
          <FeedCamera type={type} snapshot={snapshot} />
          {visualAssetUrl && <Suspense fallback={null}>
            <RobotAssembly url={visualAssetUrl} snapshot={snapshot} />
            <CameraAssets snapshot={snapshot} />
          </Suspense>}
        </Canvas>
      </div>
    </section>)}
  </section>
}
