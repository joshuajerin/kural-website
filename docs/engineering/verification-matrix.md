# Website and simulator verification matrix

Manual checks for the current implementation. This checklist describes checks to run; it does not claim they were executed when these entries were committed.

## Homepage shell
- [ ] Open `/` and confirm the hero, demonstration, modules, early-access, and footer sections render in order.
- [ ] Follow the hero CTA and verify it lands on the early-access section.
- [ ] Follow the footer Skills link and confirm it opens the Kural Skills repository.
## Route metadata
- [ ] Load `/`, `/sim`, `/robots.txt`, and `/sitemap.xml`; confirm each returns its intended page or metadata response.
- [ ] Inspect page title and description on the home and simulator routes.
- [ ] Confirm the simulator route declares `/sim` as its canonical path.
## Site header
- [ ] At the top of the page, verify the wordmark links to `#top` and has an accessible name.
- [ ] Scroll beyond the hero and confirm the header changes to its solid state.
- [ ] Use the header Pre-order link and verify the early-access section receives focus/scroll navigation.
## Interactive hero
- [ ] Wait for the hero scene to load and confirm the main heading remains readable above it.
- [ ] Move the pointer across the hero and check the robot scene responds without page-wide horizontal overflow.
- [ ] Test the hero at a narrow viewport and verify the primary CTA remains visible and operable.
## Hero scene lifecycle
- [ ] Navigate away or unmount the hero and check that animation/listener resources are cleaned up.
- [ ] Reload with reduced-motion preferences and inspect that the scene does not block access to page content.
- [ ] Check the browser console for asset-load or WebGL errors while opening the homepage.
## Showcase media
- [ ] Confirm the showcase has its labelled region and visible section heading.
- [ ] Check that showcase media remains within its stage at desktop and mobile widths.
- [ ] Verify decorative fades do not intercept pointer or keyboard interaction.
## Tool gallery
- [ ] Confirm module cards appear in the documented Lamp, Gripper, Pump order.
- [ ] Check that “Coming soon” badges are visible on the Gripper and Pump cards.
- [ ] At mobile width, verify the gallery can be explored without clipping card content.
## Waitlist configuration states
- [ ] Without Clerk configuration, verify the preview form is disabled and explains that reservations are not open.
- [ ] With test Clerk configuration, verify the configured email form is enabled.
- [ ] Confirm the early-access copy communicates that registration does not collect payment.
## Waitlist client validation
- [ ] Submit an invalid email and verify the form shows its validation message without issuing a request.
- [ ] Enter a valid email with surrounding whitespace and confirm the submitted value is trimmed.
- [ ] While a request is pending, verify duplicate submission is disabled and loading state is announced.
## Waitlist API validation
- [ ] POST malformed JSON and confirm the route returns a controlled client error rather than a server crash.
- [ ] POST an invalid email and confirm the route responds with status 400.
- [ ] POST a valid email with no Clerk secret configured and confirm the route responds with status 503.
## Clerk reservation integration
- [ ] Use a test Clerk application and verify the server sends normalized email data to Clerk.
- [ ] Confirm the Clerk secret is read only on the server and is absent from browser bundles.
- [ ] After a successful test request, verify the returned status is 201 and the UI enters its success state.
## Reservation error handling
- [ ] Re-submit an existing test address and confirm the duplicate response maps to the already-registered message.
- [ ] Simulate a provider error and verify the UI offers a retry-safe generic failure message.
- [ ] Simulate network failure and confirm loading state clears so the user can try again.
## Public navigation and indexing
- [ ] Check that internal navigation anchors resolve to existing section IDs.
- [ ] Inspect `/robots.txt` and `/sitemap.xml` responses after a production build.
- [ ] Open the footer navigation with keyboard only and verify each link is reachable.
## Responsive layout
- [ ] Check homepage layout at narrow phone, tablet, and desktop widths.
- [ ] Verify hero, module cards, and early-access panel do not introduce horizontal page scrolling.
- [ ] Increase browser text zoom and confirm headings and form controls remain legible.
## Accessibility pass
- [ ] Navigate the homepage using Tab and Shift+Tab; confirm focus remains visible.
- [ ] Inspect heading hierarchy and named landmarks on the homepage and simulator route.
- [ ] Check status and error messages in the waitlist form are announced by assistive technology.
## Simulator embedding
- [ ] Open `/sim` and verify the iframe has the accessible title “Kural robot simulator”.
- [ ] Confirm the embedded Vite application loads from `/sim/index.html` in a production build.
- [ ] At mobile width, verify the simulator frame remains usable without obscuring browser navigation.
## Simulator input mapping
- [ ] Click the simulator viewport before testing keyboard controls, as required by the simulator guide.
- [ ] Exercise forward/backward, strafe, and rotation inputs and observe the corresponding base motion.
- [ ] Change the selected arm joint and verify jog controls affect the selection rather than another joint.
## Simulator stop behavior
- [ ] Hold a movement command and release it; verify the robot stops receiving the held command.
- [ ] While movement is held, hide the tab or move focus away and verify command state is cleared.
- [ ] Pause or reset the simulation and verify active gestures and held inputs do not continue.
## Simulator recording and leader mode
- [ ] Record a short semantic command sequence and verify the recording includes model/config revision data.
- [ ] Attempt replay with a mismatched revision and verify the simulator rejects it explicitly.
- [ ] Enable leader mode only with a local test bridge and verify stop/pause actions disable leader input.
## Local development guide
- [ ] From a clean checkout, run `npm ci` and verify the lockfile-based install completes.
- [ ] Without local Clerk secrets, confirm the homepage still renders for design review.
## Website structure guide
- [ ] When changing the `/sim` route, verify the route shell stays separate from simulator implementation.
- [ ] When changing reservation behavior, trace the browser form through the API route to Clerk.
## Waitlist flow guide
- [ ] Check the 409 duplicate response displays a non-error “already on the list” message.
- [ ] Confirm an unsuccessful reservation never displays the success state.
## Deployment checklist
- [ ] Before production, verify Preview and Production Clerk credentials are set in Vercel, not committed.
- [ ] After deployment, smoke-test the canonical domain and `www` redirect using live DNS/project state.
## Simulator validation guide
- [ ] Run simulator unit tests and physics-direction tests from `simulator/` after control changes.
- [ ] Run `npm run build` in the simulator package to check TypeScript and Vite output.
## Simulator command path guide
- [ ] For a new control, verify the UI emits a semantic command rather than a direct actuator write.
- [ ] Confirm the command uses the shared controller/worker path and existing joint limits.
## Stop behavior guide
- [ ] Exercise command heartbeat timeout and verify a stale held command is cleared.
- [ ] Exercise worker failure and verify the UI does not continue sending movement commands.
## Simulator recording guide
- [ ] Check that replay restores the initial pose before replaying semantic commands.
- [ ] Confirm replay uses a fresh session identity and the normal worker actuator path.
## Asset provenance guide
- [ ] When exporting a robot asset, compare its digest to the recorded model manifest.
- [ ] Confirm website presentation derivatives are not described as validated hardware or authoritative CAD.
## Release smoke-test guide
- [ ] Run root lint/build and the simulator tests/build relevant to the changed area.
- [ ] Inspect the final diff for local secrets, generated bundles, and unsupported hardware-performance claims.
## Current-day accessibility and release review
- [ ] Check the home and simulator routes at desktop and mobile widths after any UI change.
- [ ] Run keyboard-only navigation through the hero CTA, module content, and early-access form.
