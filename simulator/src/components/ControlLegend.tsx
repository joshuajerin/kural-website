const controls = [
  { keys: ['W', 'S'], label: 'Forward / back' },
  { keys: ['A', 'D'], label: 'Strafe' },
  { keys: ['←', '→'], label: 'Rotate base' },
  { keys: ['↑', '↓'], label: 'Lift carriage' },
  { keys: ['J', 'L'], label: 'Jog joint' },
  { keys: ['G'], label: 'Gripper' },
  { keys: ['⇧'], label: 'Precision' },
]

export function ControlLegend({ focused }: { focused: boolean }) {
  return (
    <div className="control-legend">
      <div className="legend-title"><span className={`focus-dot ${focused ? 'active' : ''}`} />{focused ? 'Keyboard captured' : 'Click viewport to drive'}</div>
      <div className="legend-grid">
        {controls.map((item) => <div key={item.label}><span>{item.keys.map((key) => <kbd key={key}>{key}</kbd>)}</span><em>{item.label}</em></div>)}
      </div>
    </div>
  )
}

