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
