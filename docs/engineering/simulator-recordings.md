# Simulator recordings

Recordings capture model/config revisions, the initial robot state, semantic commands, generated actuator targets, and sampled simulation state. Replay checks that the recorded revisions match, restores the recorded starting pose, and routes commands through the worker actuators with a fresh session identity.

When changing recording serialization or replay, keep revision mismatch behavior explicit and test that replay does not bypass the normal command/worker path. Treat a recording as a simulation artifact, not evidence of calibrated physical robot performance.