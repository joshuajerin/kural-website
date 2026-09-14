import { ChevronLeft, ChevronRight, Hand, Pause, Play, RotateCcw, Square, Video, WifiOff } from 'lucide-react'
import { DEFAULT_CONTROL_CONFIG, GESTURES } from '../control'
import { GESTURE_IDS, JOINT_NAMES, type GestureId, type JointName, type RobotState } from '../types'
import { CameraFeeds } from './CameraFeeds'
import type { SimulationSnapshot } from '../physics/protocol'

interface ControlRailProps {
  robot: RobotState | null
  selectedJoint: JointName
  paused: boolean
  recording: boolean
  replaying: boolean
  collisionDebug: boolean
  snapshot: SimulationSnapshot | null
  visualAssetUrl: string | null
  onSelectJoint: (joint: JointName) => void
  onJointTarget: (joint: JointName, value: number) => void
  onGesture: (gesture: GestureId) => void
  onStop: () => void
  onPause: () => void
  onReset: () => void
  onRecord: () => void
  onReplay: () => void
  onCollisionDebug: () => void
}

const prettyJoint = (joint: JointName) => joint.replace('_', ' ')

export function ControlRail(props: ControlRailProps) {
  const { robot, selectedJoint } = props
  return (
    <aside className="control-rail" aria-label="Robot controls">
      <CameraFeeds snapshot={props.snapshot} visualAssetUrl={props.visualAssetUrl} />

      <section className="panel action-panel" aria-label="Motion controls">
        <button className="stop-button" type="button" onClick={props.onStop}><Square size={18} fill="currentColor" /> Stop motion <kbd>Space</kbd></button>
        <div className="button-grid">
          <button type="button" onClick={props.onPause}>{props.paused ? <Play size={16} /> : <Pause size={16} />}{props.paused ? 'Resume' : 'Pause'}</button>
          <button type="button" onClick={props.onReset}><RotateCcw size={16} />Reset</button>
          <button type="button" className={props.recording ? 'is-recording' : ''} onClick={props.onRecord}><Video size={16} />{props.recording ? 'Save' : 'Record'}</button>
          <button type="button" className={props.replaying ? 'is-active' : ''} onClick={props.onReplay}><Play size={16} />Replay</button>
        </div>
      </section>

      <section className="panel joint-panel">
        <div className="panel-heading"><div><span className="eyebrow">SO-101</span><h2>Arm joints</h2></div><span className="source-chip">SIM</span></div>
        <div className="joint-selector" role="listbox" aria-label="Selected joint">
          {JOINT_NAMES.map((joint) => (
            <button key={joint} type="button" role="option" aria-selected={joint === selectedJoint} className={joint === selectedJoint ? 'selected' : ''} onClick={() => props.onSelectJoint(joint)}>
              <span>{prettyJoint(joint)}</span>
              <strong>{robot?.joints[joint].value == null ? '—' : `${(robot.joints[joint].value! * 180 / Math.PI).toFixed(1)}°`}</strong>
            </button>
          ))}
        </div>
        <div className="joint-adjust">
          <button type="button" aria-label={`Decrease ${prettyJoint(selectedJoint)}`} onClick={() => props.onJointTarget(selectedJoint, (robot?.joints[selectedJoint].value ?? DEFAULT_CONTROL_CONFIG.neutralJoints[selectedJoint]) - 0.05)}><ChevronLeft size={18} /></button>
          <input
            aria-label={`${prettyJoint(selectedJoint)} target`}
            type="range"
            min={DEFAULT_CONTROL_CONFIG.joints[selectedJoint].min}
            max={DEFAULT_CONTROL_CONFIG.joints[selectedJoint].max}
            step={0.01}
            value={robot?.joints[selectedJoint].value ?? DEFAULT_CONTROL_CONFIG.neutralJoints[selectedJoint]}
            onChange={(event) => props.onJointTarget(selectedJoint, Number(event.target.value))}
          />
          <button type="button" aria-label={`Increase ${prettyJoint(selectedJoint)}`} onClick={() => props.onJointTarget(selectedJoint, (robot?.joints[selectedJoint].value ?? DEFAULT_CONTROL_CONFIG.neutralJoints[selectedJoint]) + 0.05)}><ChevronRight size={18} /></button>
        </div>
        <p className="panel-note"><kbd>J</kbd><kbd>L</kbd> jog selected · <kbd>[</kbd><kbd>]</kbd> select</p>
      </section>

      <section className="panel gesture-panel">
        <div className="panel-heading"><div><span className="eyebrow">Sequences</span><h2>Gestures</h2></div><Hand size={17} /></div>
        <div className="gesture-list">
          {GESTURE_IDS.map((gesture, index) => (
            <button key={gesture} type="button" onClick={() => props.onGesture(gesture)}><kbd>{index + 1}</kbd><span>{GESTURES[gesture].label}</span><ChevronRight size={15} /></button>
          ))}
        </div>
      </section>

      <button className={`debug-toggle ${props.collisionDebug ? 'selected' : ''}`} type="button" onClick={props.onCollisionDebug}>
        <WifiOff size={15} /> {props.collisionDebug ? 'Collision geometry visible' : 'Show collision geometry'}
      </button>
    </aside>
  )
}
