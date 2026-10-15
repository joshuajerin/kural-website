# Live Kural hero

The homepage uses `app/live-hero.tsx` and the dynamically loaded Three.js scene in
`app/live-robot-scene.ts`. It has no video playback. The other homepage demos and
`/sim` remain separate.

## Presentation asset

`public/models/kural-lamp.glb` is a **presentation derivative**, not a robot-model
authority. It was exported from the existing local Kural assembly by the local
rendering chat, with the existing custom wrist module, four-support curved
trapezoid shade, and fitted translucent insert. No mechanism was remodeled here.

The export was processed with `@gltf-transform/cli meshopt --level medium`
(59.97 MB to 13.76 MB). Meshopt compression and vertex quantization reduce browser
transfer size; joint hierarchy is retained. The loader includes the Meshopt decoder.

The metadata records imported base quaternions, local axes, and source angle
limits. In THREE coordinates, the optical marker is `KuralLampLightAnchor`, at
(0, -0.207, 0) metres relative to wrist roll; forward is local (0, -1, 0).

## Interaction and lighting

Pointer position maps directly to the receiving plane. The inverse horizontal
mapping was removed after user feedback. Each new target uses a bounded search over swivel and wrist angles followed by
local refinement from an open posture, so redundant joints cannot drift into
folded solutions. The primary objective aligns the lamp ray with the cursor on
screen; depth alignment and posture are secondary. Shoulder lift
and elbow movement stay near that posture; base swivel and wrist track the target.
Source joint limits still bound the narrower presentation ranges. A radial lamp-tip
clearance constraint keeps the diffuser clear of the mast while allowing movement
to either side. Unreachable targets
stop at the nearest comfortable pose instead of chasing the cursor through the
robot. This is a presentation constraint, not collision-aware hardware control.

The arm approaches the chosen posture with short damping and a velocity limit.
Leaving the widget holds the last target; it does not automatically recenter.
Portrait screens through 820 px use a larger, centered robot above the copy. The
lamp stays static and aims down toward the actual headline position; pointer and
touch input never steer it. The same projected lamp position, optical direction,
aperture, inverse-square illumination, glyph shadows, and scattering shader drive
both desktop and mobile. The former independently placed mobile light is removed.
Grain/air motion remains animated unless reduced motion is requested. A fixed mobile
robot renders geometry and its shadow map on demand while the light field updates
at up to 30 fps. Both viewports use the same two-megapixel rendering budget.

The spotlight follows the marker, uses inverse-square falloff, and renders a
shadow map from the robot geometry. The previous `hero-light-field.ts` treatment
is restored for the headline and air: signed-distance extruded glyphs, six area
light samples, traced text shadows, and heterogeneous single-scattering transport.
The lamp's live projected origin, direction, aperture, and camera-relative depth
feed that field. Unlit background remains transparent over black. This is a
camera-space lighting approximation combined with 3D robot shading, not full
path tracing or rigid-body physics. The field updates at up to 30 fps.

A lamp-lit Three.js text plane and scattering cone remain as the fallback when
the independent light-field context is unavailable. The accessible HTML heading
and original CTA remain in the document.

Rendering pauses offscreen and when the document is hidden. Reduced motion shows
a still pose. WebGL failure retains the HTML copy and links. Resize and unmount
release/rebuild the appropriate textures and GPU resources.
