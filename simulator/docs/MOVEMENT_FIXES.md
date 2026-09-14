# Camera, assembly, and wheel-control correction — revision 2

## Root causes and corrections

- **Detached base:** many Blender base meshes are siblings of `CTRL_Robot_Root`. Moving that node alone left the base behind. The renderer now assigns every mesh to a MuJoCo rigid body. Base plates, fixed motor mounts, and both spine segments share the chassis body.
- **Unstable visual offsets:** offsets were taken from the first live physics snapshot. They now come from an immutable source-derived reference, including the exact authored arm pose. Rendering uses `body transform × fixed visual offset` for every mesh.
- **Inverted carriage motion:** the authored carriage frame has its local Z axis pointing down. Its slide axis is now transformed from world +Z into that local frame. The fixed rails stay on the chassis. Startup sets the arm and lift servo targets before the first physics step.
- **Wrong wheel associations:** MuJoCo wheel numbering now matches Blender: 1 rear-left, 2 front, 3 rear-right. Axle positions are derived from the source assembly. Canonical +X points toward wheel 2. WASD changes only wheel targets; horizontal arrows rotate the chassis and vertical arrows control the lift.
- **Uneven omni contact:** sixteen passive ellipsoid rollers per driven wheel replace the coarse six-roller contacts. Heading feedback corrects slip through motor targets. Chassis movement still comes from contact; no planar position or heading is overwritten during driving.
- **Camera contention:** removed automatic fitting of the animated assembly. Orbit controls own only the orbit camera, with a stable target; other modes use one camera controller. The initial view looks from the clear side of the worktable. Removed the extra per-frame contact-shadow rendering pass.
- **Input timing:** command expiry now uses epoch timestamps shared by the main thread and worker. Ordered session commands are checked. Zero input no longer cancels a gesture; nonzero manual movement does. Changing the selected joint cannot leave the previous joint jogging. Inputs clear when focusing a form control or leaving the ready state.

## Verification performed without opening a browser

- `npm test`: 23 passing checks, including all exported meshes at their exact authored reference transforms, complete-assembly translation/rotation, fixed-spine isolation, and the actual MuJoCo 3.11 WASM model.
- Full-robot W/S/A/D contact tests run for three simulated seconds after settling. Each moves at least 150 mm along its requested axis; sideways error stays under 35 mm and heading error under 0.15 rad. Left/right rotation exceeds 1.2 rad with under 20 mm translation. The arm remains within 0.035 rad of its held pose.
- `npm run test:worker`: executes the real worker source in a Node worker, including startup, expired packets, continuous commands, heartbeat expiry, gesture interruption, lift direction, stop, reset, and pause. Latest measured output: `tests/generated/worker-regression.json`.
- Native MuJoCo 3.9: 600 simulated seconds idle, finite state, upright chassis, and carriage held at 430 mm.
- Official SO-101 chain comparison across three poses: maximum 0.003481 mm position error and 0.000740° orientation error. This comparison is kinematic, not physical calibration.
- Production TypeScript/Vite build passes. Visual camera smoothness and browser FPS were not rechecked after the user requested no further browser opening.

## Reproduction and limits

Run `python3 scripts/align_assembly.py` after exporting or changing model frames. It requires MuJoCo, NumPy, and SciPy, derives wheel poses and mounting frames from the evaluated manifest, and regenerates `assembly-binding.json`. It never saves the source Blender file.

The source geometry is unchanged. Belt interference and the unfinished structural clamp remain as documented in the source report; the simulator assumes a rigid spine attachment. Dynamics, mass properties, contact tuning, gravity compensation, and motor limits remain uncalibrated. The 0–860 mm authored lift joint range is retained, but low carriage positions can put the downward-pointing arm into the floor; full-range collision clearance is not established. Arbitrary joint/gesture combinations are not certified collision-free. Older recordings are rejected because the physics/control revision changed.

Refresh the existing local simulator tab when convenient to reload the updated MJCF and worker. No new browser window is necessary.
