# Robot visual asset provenance

The simulator uses exported assets under `public/robot`. The model manifest records the source model digest; exported visuals are snapshots and must not silently become the authoritative robot design. Keep source model, export scripts, generated assets, and manifest provenance aligned when updating geometry.

The website's live hero also uses a presentation derivative documented in `docs/live-hero.md`. Do not describe a rendered visualization as a validated physical build. After asset changes, verify the model loads in the browser, the relevant articulated transforms remain intact, and the documented source/digest matches the export.