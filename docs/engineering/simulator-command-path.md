# Simulator command path

User input is normalized into semantic commands before reaching the simulation worker. The shared controller and worker use the simulator's control definitions for wheel kinematics, joint limits, and gestures; UI components should not duplicate actuator math.

Relevant code areas:

- `src/control`: key mapping, command handling, kinematics, gestures, and recording.
- `src/physics`: worker protocol, simulation worker, and browser hook.
- `src/components`: control-room interface and rendered robot scene.
- `public/robot`: exported model snapshot, scene, and provenance manifest.

When adding an input, trace it through command creation, freshness/stop handling, and worker application rather than sending actuator values directly from a component.