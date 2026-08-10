# Asset provenance

Current game prototype uses code-rendered canvas/UI visuals, bundled fonts resolved by the existing framework, Lucide icons, and the project social-preview image. `assets/provenance.json` is the machine-readable release gate: a file marked as used cannot ship unless it is also approved.

No prior company photographs are used by the playable surface. Those repository images are listed as unused, unapproved, and `[VERIFY]` in the manifest so the game factory can distinguish dormant files from release assets.
