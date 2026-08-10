# Release plan

Milestone 0: private browser feel prototype.

Every candidate begins with `build_game.ps1`. A valid artifact requires design inputs, release-approved used assets, clean lint, a successful production build, and the full gameplay regression suite. The factory emits a versioned ZIP, SHA-256 digest, build manifest, provenance report, lightweight SBOM, and verification summary.

Milestone 1: polished web vertical slice with one machine, one contract arc, audio pass, controller support, onboarding tests, and shareable results.

Milestone 2: desktop demo foundation, native packaging, Steam input, achievements plan, crash reporting, cloud-save design, and store assets.

Milestone 3: Steam demo/release candidate after founder approval, rights review, privacy review, accessibility review, clean install/save testing, and rollback rehearsal.

Meta Quest begins only after the flat-screen core loop demonstrates demand. No platform approval is claimed.

The current factory packages the web vertical slice only. Unreal cooking, Blender/OpenUSD asset builds, FMOD/Wwise banks, Windows installers, Steam uploads, crash telemetry, and self-hosted CI are explicit future adapters; their absence is reported rather than hidden.
