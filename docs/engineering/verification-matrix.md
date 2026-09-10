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
