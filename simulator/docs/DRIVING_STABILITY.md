# Driving stability correction — revision 4

## Cause

This was a contact-dynamics problem remaining after the wheel-center correction. Six-dimensional roller contact added rolling and torsional friction constraints to wheels that already had explicit passive roller hinges. The resulting resistance made the driven wheels rock and lift the chassis. The floor's contact settings could also override a roller's lower contact dimension when both geometries had equal priority.

With revision 3, a four-second full-speed forward trace reproduced 15.875 mm peak-to-peak chassis height change and 16.213° maximum tilt. This diagnostic used the complete assembled robot with its authored home pose in native MuJoCo 3.9. Increasing roller count alone did not fix the rocking; changing the contact constraints did.

## Change

- Roller contacts use three dimensions: normal force and two sliding-friction directions. Passive hinges supply the rolling motion.
- Roller contact priority is 1, ensuring that the floor's angular-friction settings cannot replace the roller contact definition.
- Each wheel has 32 hidden contact rollers instead of 16, reducing variation in its supporting radius as the wheel turns.
- Wheel motor gains, maximum driving speed, free chassis, mass parameters, and visible source geometry are unchanged. Motion still comes from wheel-ground contact; chassis height, roll, and pitch are not locked or overwritten.

The generator in `scripts/tune_wheels.py` preserves these settings when `scripts/align_assembly.py` rebuilds the model. Model/control revision 4 rejects recordings made with previous dynamics.

## Validation

The updated tests sample height, tilt, and vertical speed at **every 2 ms physics step**, rather than checking only the final direction of travel. They run against the pinned **MuJoCo 3.11 WASM** package used by the application.

| Flat-floor trace | Height range (mm) | Maximum tilt (degrees) |
|---|---:|---:|
| W, full speed, 4 s | 0.0794 | 0.0435 |
| S, full speed, 4 s | 0.0783 | 0.0302 |
| A, full speed, 4 s | 0.1024 | 0.0348 |
| D, full speed, 4 s | 0.1000 | 0.0368 |
| Left rotation, full speed, 4 s | 0.0668 | 0.0335 |
| Right rotation, full speed, 4 s | 0.0524 | 0.0355 |
| Reversals, diagonals, rotation, combined motion and stops, 22 s, lift 430 mm | 0.1048 | 0.0492 |
| Same mixed sequence, lift 860 mm | 0.1391 | 0.1106 |

The regression limits are 0.5 mm peak-to-peak height, 0.5° tilt, and 0.04 m/s vertical speed. Machine-readable measurements are in `tests/generated/driving-stability.json`.

`npm test` passes all 26 tests. `npm run test:worker` passes the actual worker-source command/stop/expiry checks. `npm run build` passes. No browser was opened for these checks. These results cover flat-floor driving with the authored arm pose; they do not certify arbitrary arm configurations, obstacle traversal, or calibrated physical hardware behavior.
