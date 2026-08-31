# Website and simulator verification matrix

Manual checks for the current implementation. This checklist describes checks to run; it does not claim they were executed when these entries were committed.

## Homepage shell
- [ ] Open `/` and confirm the hero, demonstration, modules, early-access, and footer sections render in order.
- [ ] Follow the hero CTA and verify it lands on the early-access section.
- [ ] Follow the footer Skills link and confirm it opens the Kural Skills repository.
## Route metadata
- [ ] Load `/`, `/sim`, `/robots.txt`, and `/sitemap.xml`; confirm each returns its intended page or metadata response.
