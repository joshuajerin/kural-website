import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Camera, CircleAlert, Crosshair, Gauge } from 'lucide-react'
import {
  CONTINUOUS_KEY_BINDINGS,
  DEFAULT_CONTROL_CONFIG,
  DISCRETE_KEY_BINDINGS,
  keyboardIntentFromActions,
  selectJoint,
  type ContinuousControlAction,
} from './control'
import { ControlLegend } from './components/ControlLegend'
import { ControlRail } from './components/ControlRail'
import { RobotScene } from './components/RobotScene'
import { simulatorAsset } from './robot/paths'
import type { CameraMode } from './physics/protocol'
import { useSimulation } from './physics/useSimulation'
import { type GestureId, type JointName } from './types'

const CAMERA_MODES: readonly CameraMode[] = ['orbit', 'follow', 'top', 'arm', 'wrist']
const VISUAL_ASSET_CANDIDATES = [
  simulatorAsset('robot/assets/kural-assembly-v1.glb'),
  simulatorAsset('robot/visual/kural.glb'),
  simulatorAsset('robot/visual/XLeRobot_full_spine_arm_single_wheel.glb'),
  simulatorAsset('robot/meshes/kural.glb'),
  simulatorAsset('robot/kural.glb'),
]
const CHUNKED_VISUAL_ASSET = [
  simulatorAsset('robot/assets/kural-assembly-v1.glb.part-00'),
  simulatorAsset('robot/assets/kural-assembly-v1.glb.part-01'),
  simulatorAsset('robot/assets/kural-assembly-v1.glb.part-02'),
]

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

export function App() {
  const simulation = useSimulation()
  const shellRef = useRef<HTMLDivElement>(null)
  const replayInputRef = useRef<HTMLInputElement>(null)
  const actionsRef = useRef(new Set<ContinuousControlAction>())
  const pressedCodesRef = useRef(new Set<string>())
  const latestSnapshotRef = useRef(simulation.snapshot)
  const selectedJointRef = useRef<JointName>('shoulder_pan')
  const [selectedJoint, setSelectedJoint] = useState<JointName>('shoulder_pan')
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit')
  const [collisionDebug, setCollisionDebug] = useState(false)
  const [focused, setFocused] = useState(false)
  const [visualAssetUrl, setVisualAssetUrl] = useState<string | null>(null)
  const [assetChecked, setAssetChecked] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const paused = simulation.status === 'paused'

  useEffect(() => { latestSnapshotRef.current = simulation.snapshot }, [simulation.snapshot])

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    void (async () => {
      try {
        const parts = await Promise.all(CHUNKED_VISUAL_ASSET.map(async (url) => {
          const response = await fetch(url)
          if (!response.ok) throw new Error(`Missing visual asset part: ${url}`)
          return response.arrayBuffer()
        }))
        objectUrl = URL.createObjectURL(new Blob(parts, { type: 'model/gltf-binary' }))
        if (!cancelled) {
          setVisualAssetUrl(objectUrl)
          setAssetChecked(true)
          return
        }
      } catch { /* use the documented monolithic asset locations when available */ }
      for (const candidate of VISUAL_ASSET_CANDIDATES) {
        try {
          const response = await fetch(candidate, { method: 'HEAD' })
          if (response.ok) {
            if (!cancelled) setVisualAssetUrl(candidate)
            break
          }
        } catch { /* try the next documented asset location */ }
      }
      if (!cancelled) setAssetChecked(true)
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [])

  const setCurrentJoint = useCallback((joint: JointName) => {
    selectedJointRef.current = joint
    setSelectedJoint(joint)
  }, [])

  const clearControls = useCallback(() => {
    pressedCodesRef.current.clear()
    actionsRef.current.clear()
    simulation.send({ kind: 'stop' })
  }, [simulation.send])

  const sendContinuous = useCallback(() => {
    const intent = keyboardIntentFromActions(
      actionsRef.current,
      DEFAULT_CONTROL_CONFIG.maxLinearVelocity,
      DEFAULT_CONTROL_CONFIG.maxYawRate,
      DEFAULT_CONTROL_CONFIG.liftMaxVelocity,
      DEFAULT_CONTROL_CONFIG.joints[selectedJointRef.current].maxVelocity,
    )
    simulation.send({ kind: 'drive', vx: intent.vx, vy: intent.vy, yawRate: intent.yawRate })
    simulation.send({ kind: 'moveLift', velocity: intent.liftVelocity })
    simulation.send({ kind: 'jogJoint', joint: selectedJointRef.current, velocity: intent.jogVelocity })
  }, [simulation.send])

  const cycleCamera = useCallback(() => {
    setCameraMode((current) => CAMERA_MODES[(CAMERA_MODES.indexOf(current) + 1) % CAMERA_MODES.length])
  }, [])

  useEffect(() => {
    if (simulation.status !== 'ready') clearControls()
  }, [simulation.status, clearControls])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (actionsRef.current.size > 0 && simulation.status === 'ready') sendContinuous()
    }, 100)
    return () => window.clearInterval(interval)
  }, [sendContinuous, simulation.status])

  useEffect(() => {
    const active = () => shellRef.current?.contains(document.activeElement) === true
    const onKeyDown = (event: KeyboardEvent) => {
      if (!active() || isEditableTarget(event.target) || simulation.status !== 'ready') return
      const continuous = CONTINUOUS_KEY_BINDINGS[event.code]
      const discrete = DISCRETE_KEY_BINDINGS[event.code]
      if (!continuous && !discrete) return
      if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault()

      if (continuous) {
        pressedCodesRef.current.add(event.code)
        actionsRef.current.add(continuous)
        sendContinuous()
        return
      }
      if (event.repeat || !discrete) return
      if (discrete.kind === 'selectJoint') {
        setCurrentJoint(selectJoint(selectedJointRef.current, discrete.offset, Object.keys(DEFAULT_CONTROL_CONFIG.joints) as JointName[]))
      } else if (discrete.kind === 'toggleGripper') {
        const current = latestSnapshotRef.current?.robot.joints.gripper.value ?? 0
        const limits = DEFAULT_CONTROL_CONFIG.joints.gripper
        simulation.send({ kind: 'setGripper', position: current > (limits.min + limits.max) / 2 ? limits.min : limits.max })
      } else if (discrete.kind === 'gesture') {
        simulation.send({ kind: 'playGesture', gesture: discrete.gesture })
      } else if (discrete.kind === 'stop') {
        clearControls()
      } else if (discrete.kind === 'cycleCamera') {
        cycleCamera()
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      const continuous = CONTINUOUS_KEY_BINDINGS[event.code]
      if (!continuous) return
      pressedCodesRef.current.delete(event.code)
      actionsRef.current.clear()
      for (const code of pressedCodesRef.current) {
        const action = CONTINUOUS_KEY_BINDINGS[code]
        if (action) actionsRef.current.add(action)
      }
      if (active() && !isEditableTarget(event.target)) {
        if (event.code.startsWith('Arrow')) event.preventDefault()
        sendContinuous()
      }
    }
    const onWindowBlur = () => {
      clearControls()
      setFocused(false)
    }
    const onVisibility = () => {
      if (document.hidden) {
        clearControls()
        simulation.pause(true)
        setFocused(false)
      }
    }
    window.addEventListener('keydown', onKeyDown, { passive: false })
    window.addEventListener('keyup', onKeyUp, { passive: false })
    window.addEventListener('blur', onWindowBlur)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onWindowBlur)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [clearControls, cycleCamera, sendContinuous, setCurrentJoint, simulation.pause, simulation.send, simulation.status])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 4500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const playGesture = (gesture: GestureId) => {
    clearControls()
    simulation.send({ kind: 'playGesture', gesture })
  }

  const reset = () => {
    clearControls()
    simulation.reset()
    setNotice('Scene reset to authored initial state')
  }

  const togglePause = () => {
    clearControls()
    simulation.pause(!paused)
  }

  const toggleRecording = () => {
    if (simulation.recording) {
      simulation.stopRecording()
      setNotice('Recording downloaded')
    } else {
      simulation.startRecording()
      setNotice('Recording commands and state')
    }
  }

  const openReplay = () => replayInputRef.current?.click()
  const loadReplay = async (file: File | undefined) => {
    if (!file) return
    try {
      await simulation.replay(file)
      setNotice(`Replaying ${file.name}`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not read recording')
    }
  }

  const focusViewport = () => {
    shellRef.current?.focus({ preventScroll: true })
    setFocused(true)
  }

  const visualUnavailable = assetChecked && !visualAssetUrl
  const sceneStatus = visualUnavailable && simulation.status !== 'loading' ? 'error' : simulation.status
  const base = simulation.snapshot?.robot.base.position ?? [0, 0, 0]
  const baseOrientation = simulation.snapshot?.robot.base.orientation ?? [1, 0, 0, 0]
  const headingDegrees = Math.atan2(
    2 * (baseOrientation[0] * baseOrientation[3] + baseOrientation[1] * baseOrientation[2]),
    1 - 2 * (baseOrientation[2] ** 2 + baseOrientation[3] ** 2),
  ) * 180 / Math.PI
  const lift = simulation.snapshot?.robot.lift.value

  return (
    <div className="app-shell" ref={shellRef} tabIndex={0} onFocus={(event) => {
      if (isEditableTarget(event.target)) clearControls()
      setFocused(true)
    }} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        clearControls()
        setFocused(false)
      }
    }}>
      <main className="workspace">
        <div className="stage-column">
          <div className="viewport-frame">
            <RobotScene snapshot={simulation.snapshot} status={sceneStatus} cameraMode={cameraMode} collisionDebug={collisionDebug} visualAssetUrl={visualAssetUrl} onFocus={focusViewport} />
            <div className="viewport-top-left">
              <span className="view-label"><Camera size={13} /> {cameraMode} camera</span>
              <div className="camera-tabs" aria-label="Camera mode">
                {CAMERA_MODES.map((mode) => <button key={mode} type="button" className={mode === cameraMode ? 'selected' : ''} onClick={() => setCameraMode(mode)}>{mode}</button>)}
              </div>
            </div>
            <div className="viewport-top-right">
              <span><Crosshair size={13} /> X {base[0].toFixed(2)} · Y {base[1].toFixed(2)} · H {headingDegrees.toFixed(0)}°</span>
              <span><Gauge size={13} /> Lift {lift == null ? '—' : `${Math.round(lift * 1000)} mm`}</span>
            </div>
            {(simulation.status === 'loading' || simulation.status === 'error' || visualUnavailable) && (
              <div className={`scene-message ${simulation.status === 'error' || visualUnavailable ? 'is-error' : ''}`}>
                <CircleAlert size={18} />
                <div><strong>{visualUnavailable && simulation.status !== 'error' ? 'Visual assembly unavailable' : simulation.status === 'error' ? 'Physics unavailable' : 'Preparing simulation'}</strong><span>{visualUnavailable && simulation.status !== 'error' ? 'The exported GLB has not landed at a supported robot asset path.' : simulation.detail}</span></div>
              </div>
            )}
            <ControlLegend focused={focused} />
          </div>
          <div className="stage-footer">
            <span><Box size={13} /> Source: XLeRobot_full_spine_arm_single_wheel.blend</span>
            <span>Dynamics are uncalibrated · software stop only</span>
          </div>
        </div>

        <ControlRail
          robot={simulation.snapshot?.robot ?? null}
          selectedJoint={selectedJoint}
          paused={paused}
          recording={simulation.recording}
          replaying={simulation.replaying}
          collisionDebug={collisionDebug}
          snapshot={simulation.snapshot}
          visualAssetUrl={visualAssetUrl}
          onSelectJoint={setCurrentJoint}
          onJointTarget={(joint, value) => simulation.send({ kind: 'setJointTargets', targets: { [joint]: value } })}
          onGesture={playGesture}
          onStop={clearControls}
          onPause={togglePause}
          onReset={reset}
          onRecord={toggleRecording}
          onReplay={openReplay}
          onCollisionDebug={() => setCollisionDebug((value) => !value)}
        />
      </main>

      <input ref={replayInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void loadReplay(event.target.files?.[0])} />
      {notice && <div className="notice" role="status">{notice}</div>}
    </div>
  )
}
