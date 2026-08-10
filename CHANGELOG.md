# Changelog

## 2026-08-10 - Retention and active-inspection gate

- Completed the three-contract manual campaign with ordered profile, pocket, drill, and finish operation plans and explicit operation signoff.
- Turned the three cutter identities into enforced process choices with incompatible-operation lockouts and distinct removal, load, wear, access, and finish behavior.
- Replaced passive inspection with three active characteristics per contract, instrument selection, visible tolerance evidence, findings, and accept/rework/scrap disposition gates.
- Added contract mastery, sequential unlocks, advance/retry behavior, repeat-attempt rewards, and safe migration from device-local save v2 to v3.
- Added focused visual treatment for operation routing and the inspection bay while retaining pointer, touch, and keyboard machining paths.
- Verified the production build and 15 automated tests covering routing, tool capabilities, inspection, disposition, migration, responsive interaction contracts, rendered routes, and both playable modes.
- Added `build_game.ps1` as the one-command vertical-slice factory: it validates design/provenance inputs, lints, builds, tests, hashes, reports, and packages a playable ZIP.
- Added machine-readable asset provenance, a lightweight dependency inventory, deterministic build manifests, and explicit reporting for native production stages that are not yet implemented.
- Closed three pre-existing whole-project lint failures so the factory can enforce a clean release gate.

## 2026-08-04 - Manual Mill keyboard accessibility fix

- Closed a gap where `ACCESSIBILITY.md` and `FEATURE_INVENTORY.md` claimed keyboard jogging was shipped, but the manual-campaign canvas (the game rendered at `/`) only had pointer/touch handlers.
- Added arrow-key/WASD cursor jogging (Shift for a finer 0.25-cell step) and Space/Enter to cut in place, wired through the existing cut/telemetry pipeline so keyboard and pointer cuts behave identically.
- Removed `app/game-engine.ts` and `tests/game.test.mjs`: leftover from the original single-contract prototype, superseded by `app/manual-campaign-engine.ts`, not imported anywhere, and not part of the `npm test` script. The test file asserted on removed UI copy ("ACCEPT CONTRACT") and would have failed if it had ever been run.
- Verified: `npm test` (build + 9 tests) passes; manual mill and G//CODE Stage both play through end-to-end in a local dev server with no console/server errors.

## 2026-08-03 - G//CODE Stage campaign pass

- Reframed the creative visualizer as a three-contract machining campaign.
- Added Z-depth cutting, G02/G03 arcs, unit and positioning modes, tool/coolant/spindle state, stock removal, cycle estimates, inspection grading, alarms, XP, and device-local progression.
- Added deterministic behavioral coverage for arc interpolation, stock removal, grading, and unsafe spindle state.

## 2026-08-03 — G//CODE Stage

- Added a playable creative-coding module at `/gcode`.
- Added editable simplified G-code, realtime ASCII rasterization, beat-stepped playback, active-line feedback, scoring, remix flags, and copyable text performances.
- Added three starter compositions and explicit boundaries against machine-ready use.
- Added a mobile composition and reduced-motion handling.

## 2026-08-03 — Portfolio benchmark pass

- Benchmarked the Krool World game portfolio for short-session clarity, systemic depth, replay structure, and cross-platform reach.
- Defined 10-second comprehension, 60-second feedback, and 3-minute inspection targets.
- Reframed the next milestone around three contracts and three real tool tradeoffs.
- Added regression and direct visual/browser release gates.

## Unreleased - Vertical slice 0.1

- Pivoted the precision-manufacturing marketing site into a browser game prototype.
- Defined the Emergency Drive Plate contract and deterministic cutting model.
- Added spindle, feed, heat, wear, chatter, overcut, tool-break, inspection, scoring, credits, and retry systems.
- Added keyboard, pointer/touch, mute, reduced-motion, and device-local progression support.
