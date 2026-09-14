# Camera assets, coordinates, and gestures — revision 9

Revision 9 fixes the wrist module's mechanical fit: the source plate is tilted **25°** and has a **27 mm square hole pattern**. The PCB, four screw holes, 3 mm spacers, and 12 mm lens barrel now follow that measured plate frame. The lens toes inward toward the fingers. Gripper gesture checks use the tool frame independently of the camera's viewing direction. The fitted Blender assembly and independent fit measurements are in [the wrist/tool package](../../kural-end-effectors/README.md). The active wrist visual is `camera-wrist-so101-v9.glb`.

The two side feeds and main wrist/mast views use the same exported assemblies and MuJoCo optical bodies. The header and Command / Live controls title remain removed.

## Exact source assets

- **18-inch mast:** `Camera_mast_18in_flat_holes.stl`, from `/Users/joshuajerin/Desktop/jarvis/kural/camera_mount_18in_fixed/`. SHA-256: `d5606574245910a81ff2871d206f13eca4109fee928d5a98495d133b4257db3e`.
- **Mast assembly and camera:** `Kural_camera_mount_18in_fixed.blend` in that directory. Its 150 mast, hardware, and Arducam B0261 mesh objects are exported with evaluated transforms. The source's navigation camera supplies the lens frame.
- **Wrist:** `Wrist_Cam_Mount_32x32_UVC_Module_SO101.stl`, from Downloads, matching the earlier camera setup in `Desktop/jarvis/mujoco-mobile-manipulator/outputs/add_robot_cameras.py`. SHA-256: `b4345ccf23f1f2ed3f4885c205cac5afbed6ddd1b183617c4801751e3bafb7b4`. This is the integrated SO-101 fixed-jaw/wrist follower replacement. Only the original fixed follower visual is replaced; the moving jaw and motors remain. The SO-100 variant is a different part and was not used on this SO-101 arm.

The exact STL copies and body-local GLBs are in `public/robot/assets/`. `public/robot/camera-rig.json` records hashes, source world matrices, parent frames, and optical poses. `scripts/export_camera_assets.py` reproduces the export in Blender background mode without saving either source assembly.

The 32×32 UVC PCB and M12 lens are a dimension-based visual model fitted to the wrist STL's aperture. Their lens model and field of view are not measured camera calibration.

## Mounts and axes

**18 inches is the mast's overall length, 457.2 mm.** It is not the lens height above the chassis. The mast attaches to and moves with `lift_carriage`. At the saved 430 mm lift position, its lens is approximately **982.09 mm above the floor**, with the source's **65° downward tilt**.

The wrist assembly follows `wrist_roll_link`; its camera starts at the visible lens front, beside the gripper, rather than at the tool tip. The square UVC module is oriented for an upright image at zero wrist roll in the forward pose. Wrist roll rotates its image naturally.

Canonical robot coordinates remain X forward toward wheel 2, Y left, Z up. Rendering converts these to Three's Y-up frame once. Raw optical frames use `B × bodyPose`; GLB offsets already converted to Y up use `B × bodyPose × inverse(B)`. Mixing those conversions caused the previous misplaced and sideways views. All optical cameras look along local **−Z**, with local **+Y** as image up.

The side feeds now share the main workshop visuals and include both camera assemblies. Mast FOV is an illustrative 90° vertical perspective from the saved scene; it does not reproduce the B0261 fisheye distortion. Wrist FOV is an estimated 72° vertical.

## Forward gestures

Revision 7 incorrectly accepted poses pointing backward into the rail because it tested only the vertical component. Wave, point, and inspection now extend toward chassis +X with approximately **4.3–4.5° upward pitch**. Home and stow retain their explicitly allowed downward poses. A transition starting from home necessarily begins in that downward resting pose.

Wave rolls the wrist through ±0.55 rad while keeping the gripper facing forward. Segment durations obey the configured velocity and acceleration limits for cubic smoothstep, calculated identically by the shared controller and physics worker. Manual movement still cancels a gesture.

## Verification

- Exact STL hashes checked against the supplied saved files.
- Optical positions and directions checked against source matrices through the complete frame conversion.
- Lift travel moves the mast by the same amount while leaving the chassis fixed.
- Upright wrist image and wrist-roll attachment regression checks.
- Every affected keyframe and wave interpolation checked for positive chassis-forward direction and slight upward pitch.
- Actual MuJoCo 3.11 WASM servos run each gesture from home, with joint tracking and modeled collision checks. The largest non-roller contact penetration was approximately 0.079 mm; no arm/rail interference occurred.
- [Offline assembly](verification/point-assembly.png), [wrist mount](verification/wrist-mount.png), [wrist lens view](verification/wrist_camera_optical.png), and [mast lens view](verification/spine_camera_18in_optical.png) were rendered from exported mesh offsets and MuJoCo body poses. These are Blender inspection renders, not browser screenshots.

No browser was opened or controlled for this correction. Physics remains uncalibrated: camera mass/inertia, lens intrinsics, printed-part tolerances, and hardware tracking require physical measurements. Camera meshes are visual geometry; their detailed collision shapes have not been added. Existing belt overlap and rigid spine assumptions remain documented in the model report.
