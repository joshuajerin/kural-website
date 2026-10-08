# Simulator stop and command freshness

Held movement commands are time-bounded: the physics worker clears them when it has not received a heartbeat for 250 ms. The simulator also clears held input when the tab is hidden, focus is lost, the simulation is paused or reset, or the worker fails.

Preserve these stop paths when changing keyboard, panel, gesture, or leader inputs. A new control should be tested for release, focus loss, pause/reset, and worker failure—not only for the happy-path motion. This is a software-simulation safeguard and does not establish safety for physical hardware.