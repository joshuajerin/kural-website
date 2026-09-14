# Kural model provenance and limitations

## Delivered model

The current camera additions and gesture corrections are documented in [revision 8 camera provenance and verification](CAMERA_VIEWS.md). The exact flat-hole 18-inch carriage mast and integrated SO-101 wrist-camera STL replace the earlier substitute camera parts. Camera transforms are recorded separately in `public/robot/camera-rig.json`.

The browser visual is a versioned, evaluated export from the authoritative Blender assembly:

`/Users/joshuajerin/Documents/Codex/2026-09-12/se/outputs/XLeRobot_full_spine_arm_single_wheel.blend`

The source `.blend` is opened in Blender background mode and is never saved. The export includes visible meshes, curves, named control empties, hierarchy, materials, evaluated object transforms, and supported custom properties. Camera and light objects are omitted.

`public/robot/model-manifest.json` records SHA-256 hashes for the source, generated GLB, and copied verification reports. It also records every exported object's parent, evaluated dimensions, world matrix, and custom properties. The GLB uses glTF's Y-up convention; the source and MuJoCo model use Z up. All dimensions are metres. No blanket millimetre conversion is applied.

The canonical robot frame is right-handed: X forward, Y left, and Z up. Forward points toward the axle of authored node `Wheel_4in_LeKiwi_2`.

## Articulation

The authored GLB hierarchy preserves these stable visual nodes:

- `CTRL_Robot_Root`, `CTRL_Lift_Carriage`, and `SO101_Mount`
- The six `SO101_Joint_*` nodes: shoulder pan, shoulder lift, elbow flex, wrist flex, wrist roll, and gripper
- `Wheel_4in_LeKiwi_1`, `Wheel_4in_LeKiwi_2`, and `Wheel_4in_LeKiwi_3`

The physics scene provides a free chassis, three wheel hinges with velocity actuators, passive contact rollers, one vertical lift slide, and six arm position actuators. Adjacent arm links are excluded from self-contact. Other arm and environment contacts remain enabled. The workshop contains a floor, table, and three dynamic test blocks.

The SO-101 child-frame transforms and joint limits follow [TheRobotStudio's official `so101_new_calib.urdf`](https://github.com/TheRobotStudio/SO-ARM100/blob/main/Simulation/SO101/so101_new_calib.urdf). The simulator keeps the Blender-authored arm mounting as one fixed transform above that chain, so the authored placement is preserved without baking its posed joint angles into the kinematic origins. `scripts/validate_kinematics.py` compares the MuJoCo tool frame against the official chain at three representative poses; revision 2 measured 0.003481 mm position error and 0.000740 degrees orientation error. See [revision 2 corrections and verification](MOVEMENT_FIXES.md) for the carriage-frame, wheel, rendering, and camera changes.

## Parameter provenance

| Parameter | Value | Status |
|---|---:|---|
| Scene unit scale | 1.0 m/unit | Authored and checked during export |
| Wheel diameter | 0.1016 m nominal | Manufacturer specified |
| Wheel width | 0.030 m | Authored |
| Rail section | 0.020 x 0.040 m | Confirmed nominal envelope |
| Exposed rail height | 1.000 m | Authored |
| Lift travel | 0.860 m | Authored, physically unverified |
| Initial authored lift position | 0.430 m | Authored |
| Belt travel | 0.040 m/revolution | Authored, physically unverified |
| SO-101 joint frames and limits | `so101_new_calib.urdf` | Manufacturer project source |

Mass, inertia, actuator limits, contact values, and the gravity compensation used by the simulated lift/arm servos are estimates. The manifest labels the source parameters as estimated. Physical measurements are required before claiming real-world tracking accuracy.

## Known limitations

The source verification reports identify two unresolved physical issues:

- Belt and tooth geometry intersects the unchanged plate openings.
- The seated spine does not have a validated structural clamp or mounting hardware.

The visual export preserves the supplied geometry. The physics model uses simplified collision shapes and a rigid belt transmission. It does not redesign the assembly or simulate a deformable belt.
