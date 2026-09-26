# Website structure

- `app/page.tsx` composes the landing page sections and sets the early-access form's configured state from the public Clerk key.
- `app/live-hero.tsx` and `app/live-robot-scene.ts` provide the interactive Three.js hero.
- `app/showcase-media.tsx` and `app/tool-gallery.tsx` render demonstration and wrist-module content.
- `app/waitlist-form.tsx` owns the browser-side reservation states.
- `app/api/waitlist/route.ts` validates and forwards reservations to Clerk.
- `app/sim/page.tsx` embeds the standalone Vite simulator from `/sim/index.html`.

Keep robot simulation implementation changes inside `simulator/` unless the Next.js route or its presentation shell itself needs to change.