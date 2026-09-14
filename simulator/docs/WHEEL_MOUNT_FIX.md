# Wheel mounting correction — revision 3

The previous model used each imported Blender wheel object's origin as its hinge center. Those origins are shared CAD placement references, not the center of the circular wheel. Each origin is 18.5 mm above the wheel center and approximately 22.55 mm inward along its shaft. Rotating around that origin makes the wheel visibly orbit above and below its mount. The earlier reference-pose tests did not exercise individual wheel spin and therefore missed this error.

`scripts/extract_wheel_geometry.mjs` now measures the evaluated GLB vertices in each wheel's local coordinates. It identifies the center from the wheel bounds and the axle from the thin dimension of the wheel. `public/robot/wheel-geometry.json` stores these source-space centers and axes, together with the input GLB hash. `scripts/align_assembly.py` uses these centers and axes to place the MuJoCo wheel bodies and generate the fixed visual offsets. Control kinematics uses the same geometry, avoiding a separate guessed axle layout.

The visual wheel and its couplers spin around the centered shaft. Motor housings, chassis plates, and fixed mounts remain attached to the chassis. The supplied source meshes are unchanged. The canonical frame still faces wheel 2; the complete assembly's height is aligned using actual wheel centers, placing the visual tires at the floor rather than below it.

Validation without a browser:

- The real GLB wheel meshes were tested at 0°, 90°, 180°, 270°, and 360°. Center displacement remains below 0.0001 mm, axle-direction vector error below 0.000001, and a surface vertex moves more than 30 mm to prove rotation is occurring.
- All 24 unit/model tests pass, including full-model MuJoCo 3.11 WASM forward, backward, strafe, and chassis rotation tests.
- The actual worker-source checks pass for commands, expiry, stopping, gestures, lift, and pause.
- TypeScript and production build pass.

To regenerate after changing the GLB, run `node scripts/extract_wheel_geometry.mjs`, then `python3 scripts/align_assembly.py`. No Blender source file is modified. Revision 3 rejects older recordings because their model/control geometry differs. Dynamics remain uncalibrated; this correction establishes the visual mounting and wheel-axis geometry, not measured hardware tracking.
