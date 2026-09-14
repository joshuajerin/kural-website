# Kural browser simulator

Kural Control Room is a local browser simulator for the XLeRobot-based mobile manipulator. It runs MuJoCo in a Web Worker and renders the authored Blender assembly from physics body transforms. Keyboard, gesture, and panel inputs use semantic commands; the worker and standalone controller share wheel kinematics, limits, and gesture definitions.

Revision 2 corrects the complete-assembly attachment, lift axis, wheel mapping, and camera ownership. See [movement corrections and verification](docs/MOVEMENT_FIXES.md).

Revision 3 fixes wheel pivots using measured mesh centers and axle directions, so wheels spin in place on their mounts. See [wheel mounting correction](docs/WHEEL_MOUNT_FIX.md).

Revision 4 removes the contact constraints that caused chassis bouncing while driving and adds per-step stability tests. See [driving stability correction and measurements](docs/DRIVING_STABILITY.md).

Revision 8 uses the saved flat-hole 18-inch carriage mast with its Arducam B0261 and the integrated SO-101 32×32 wrist-camera STL. Lens views share the corrected coordinate conversion; wave, point, and inspection face chassis-forward with slight upward pitch. See [camera sources, views, and gesture verification](docs/CAMERA_VIEWS.md).

The visual source is `XLeRobot_full_spine_arm_single_wheel.blend`. The copy used by the simulator is recorded with its SHA-256 digest in `public/robot/model-manifest.json`.

## Run locally

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Click the simulation viewport before using keyboard controls.

## Controls

| Keys | Action |
| --- | --- |
| `W` / `S` | Forward / backward |
| `A` / `D` | Strafe left / right |
| `←` / `→` | Rotate the whole robot left / right |
| `Q` / `E` | Rotation aliases |
| `↑` / `↓` | Raise / lower the carriage |
| `[` / `]` | Select arm joint |
| `J` / `L` | Jog selected joint |
| `G` | Toggle gripper |
| `1`–`5` | Home, wave, point, inspect, stow |
| `Space` / `Escape` | Software stop and cancel gesture |
| `C` | Cycle camera |
| `Shift` | Precision mode while held |

Held movement commands expire in the physics worker when their heartbeat is missing for 250 ms. Focus loss, a hidden tab, pause, reset, or worker failure also clears held inputs.

Recordings contain the model/config revisions, initial robot state, semantic commands, generated actuator targets, and sampled simulation state. Replay rejects mismatched revisions, restores the recorded robot pose, and sends the commands through the same worker actuators with a fresh session identity.

## Verification

```bash
npm test
npm run test:worker
npm run build
python3 scripts/validate_model.py
```

With the Python `mujoco`, `numpy`, and `scipy` packages installed, the release-level physics checks are also reproducible:

```bash
python3 scripts/validate_kinematics.py
python3 scripts/validate_dynamics.py
```

The model report in `docs/MODEL_REPORT.md` identifies which values come from the authored file and which remain estimated. The present simulation is not evidence that physical wheel traction, lift travel, torque, speed, or payload response is calibrated.

## Architecture

- `src/control`: DOM-free semantic command handling, omniwheel kinematics, limits, gestures, recording, and the dry-run backend.
- `src/physics`: MuJoCo worker, browser client, fixed-step timing, command freshness, and state snapshots.
- `src/components`: control-room interface and Three.js scene.
- `public/robot`: exported visual snapshot, MuJoCo scene, and provenance manifest.
- `scripts`: reproducible Blender export and model validation.
