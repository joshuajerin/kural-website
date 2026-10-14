# Website module gallery

Order: Lamp, Gripper, Pump. The Gripper and Pump cards carry a top-right “Coming soon” badge. All three images show the tool attached to the articulated arm.

These are rendered product visualizations, not photographs or physical validation.
The gallery does not modify any robot description or CAD source. Rebuild stills with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python docs/scripts/render-module-gallery.py
```

Sources:

- Lamp: existing uncompressed website presentation derivative at `/Users/joshuajerin/.codex/visualizations/2026/10/12/kural-live-hero/robot-lamp.glb`, including the four-support shade and translucent diffuser.
- Gripper: custom Kural R1 white parallel palm-gripper assembly, `/Users/joshuajerin/Desktop/jarvis/kural/accessories/so101-parallel-gripper/assembly.glb`. The visual is mounted at the SO-101 wrist datum; fit, actuation, and physical gripping performance are not validated by this website render.
- Pump: existing coaxial suction visual concept at `/Users/joshuajerin/Desktop/jarvis/kural/mac/cad/so101-suction-cup/motor-drive/GLB/suction_visual.glb`. This is the authored visual concept; it is not evidence of manufactured pump performance.

The page's requested agent list is “grok bot”, “dots”, “instinct”, each with a checkmark. This content change adds no agent connection code and does not verify integrations. Capability cards describe Autonomous navigation, Visual intelligence, and Modular tools; the rail scrolls horizontally on mobile. No production deployment is performed by this change.
