# Content pipeline

Contracts are data-driven records containing customer context, stock, material, target geometry, ordered operations, tool constraints, inspection characteristics, rewards, and scoring thresholds. Three contract records now validate through renderer-independent tests.

The current vertical-slice factory is `build_game.ps1`. It treats design docs and provenance as production inputs, runs lint/build/tests, packages the playable worker output, hashes every shipped file, and emits build, asset, dependency, and verification reports.

Future content tooling will preview masks, simulate ideal cuts, calculate par scores, and run deterministic regression scenarios before a contract can ship. Native Unreal, Blender/OpenUSD, audio middleware, Steam, and CI stages remain gated until the browser retention slice has observed playtest evidence.
