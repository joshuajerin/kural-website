# Release smoke-test checklist

Use this focused pass after changes to the homepage or simulator:

- Load `/` at desktop and narrow mobile widths; confirm navigation, hero, showcase, tool gallery, and footer links work.
- Check the early-access section both with and without Clerk configuration; never submit real personal information as a test.
- Load `/sim`; confirm the embedded application initializes and keyboard controls respond only after the viewport receives focus.
- Exercise movement, gesture cancel, pause/reset, camera cycling, and focus loss in the simulator.
- Run the root lint/build checks and the simulator test/build checks that match the changed area.
- Confirm no generated files, local secrets, or unvalidated hardware claims entered the release.

The simulator is a browser-side demonstration; its behavior does not certify physical robot capabilities.