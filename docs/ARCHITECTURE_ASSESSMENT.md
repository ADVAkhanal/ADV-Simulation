# Repository Architecture Assessment

First engineering deliverable per `PRODUCT_SPEC.md` §42. Written before any new
systems were built, per the operating instruction in §44 ("inspect current
repository state" comes first).

## Current state (inherited from ADV-Game)

A single flat Next-style app (`vinext` + React 19), no package boundaries:

```
app/
  manual-campaign.tsx          — cutting loop, telemetry, contracts, inspection,
                                  UI rendering, ALL in one component tree
  manual-campaign-engine.ts    — contract data + grading functions
  flagship-machining-kit.tsx   — 3D machining cell (R3F)
  three-machining-stage.tsx    — Three.js systems layer (V3 merge)
  gcode/                       — G-code programming mode
  turn/                        — turning-cell mode
  lab/                         — asset pipeline / 3D asset viewer
  mode-dock.tsx                — top-level navigation between modes
```

No `packages/` directory exists. No workspace boundaries. `package.json` name is
still `project-toolpath-prototype`.

## Verified against §3/§4's core requirement

> React/rendering/UI code must not determine machining truth.

**This requirement is currently violated throughout.** `manual-campaign.tsx` computes
cutting state, tool wear signals, grading, and telemetry directly inside the React
component tree via `useState`/`useRef`, interleaved with JSX. There is no
`step(state, action, deltaTime) → SimulationStepResult` boundary. There is no
separation between "what happened in the simulation" and "what got rendered." This
is the single most important structural gap relative to the spec, and it is the
reason simulation-core has to be extracted rather than added alongside.

## Verified trademark/IP inventory (§2)

**Correction to a claim made earlier in this project's own docs.** `ROADMAP.md`,
`ART_PROMPTS_V2.md`, and the first draft of `PRODUCT_SPEC.md` asserted that KURT,
Mitutoyo, "HAAS NGC," and "VF-750" branding was present in the game. That claim was
accurate for the raw `.codex/generated_images` cache reviewed earlier in this
project's history, but **it was never verified against what is actually shipped.**

A full scan was run against this repo:

- **Text/code scan** (`grep` across `.ts/.tsx/.js/.css/.md/.json`, excluding
  `node_modules`): zero matches for `kurt|mitutoyo|haas|VF-750|NGC` in application
  code. All matches were in this project's own docs describing the (unverified)
  risk.
- **Visual inventory of all 9 shipped image assets** in `public/assets/` — every
  file was individually opened and inspected: `toolpath-cnc-keyart-v1.webp`,
  `night-shift-vmc-cell-v1.webp`, `night-shift-factory-floor-v1.webp`,
  `achievement-emblem-atlas-v1.webp`, `process-emblem-atlas-v1.webp`,
  `emergency-drive-plate-v2.webp`, `orbital-structural-rib-v2.webp`,
  `sensor-bracket-v2.webp`, `toolpath-parts-lineup-v1.webp`. **None contain legible
  brand names, logos, or readable model numbers.**

**Verified status: no trademark exposure currently exists in this repository's
shipped assets.** `ROADMAP.md` and `ART_PROMPTS_V2.md` have been corrected to reflect
this. The risk is real only if someone re-adds unfiltered images from the raw
`.codex/generated_images` cache without the crop/regeneration discipline already
used for the three contract-art images — the forbidden-brand CI scan (§2) should
still be built so this stays true going forward rather than by accident.

## Target-vs-current gap summary

| Spec requirement | Current state | Gap |
|---|---|---|
| `packages/simulation-core` etc. (§4) | Does not exist | Full package structure to create |
| Deterministic `step()` API (§4) | Simulation logic lives inside React components | Full extraction required |
| Seeded RNG for assessment-relevant randomness (§5) | No RNG seeding found | Not started |
| `MachineProfile` schema (§6) | Single hardcoded machine per contract | Schema + multi-profile support needed |
| `ToolState` schema (§7) | Single `condition` scalar (0-100) exists in `manual-campaign.tsx` | Needs decomposition into latent states |
| Procedural acoustics (§8-10) | `audioRef`/`lastCutTone` exist — simple Web Audio tone generation, not tooth-pass/harmonic synthesis | Real signature feature not yet built; `packages/chiptune-synth` (built for the sibling ADV-WI-Studio repo) proves the synthesis technique works and is the right starting point |
| Chatter model (§11) | Not present | Not started |
| `ShopGrievance` schema (§14) | `docs/INDUSTRY_GRIEVANCES.md` exists as a curated research table (25 entries, sourced, categorized by validation confidence) but is not a data model | Needs conversion to the typed schema |
| Competency model (§22) | `ROLE_LADDER` exists with real O*NET codes — closer to spec-compliant than most other systems | Needs to become the actual internal model rather than flavor text |
| Event telemetry (§23) | No structured event log; state changes happen via React state only | Not started |
| Instructor dashboard (§25) | Does not exist | Not started |
| Validation records (§28) | Do not exist | Not started |

## What this means for sequencing

Per §41/§44, the next increments (not attempted in this pass — each is its own
bounded piece of work) are:

1. Stand up empty `packages/*` workspace boundaries with schema-only TypeScript
   (deliverables 3–9 in §42) — no behavior yet, just the types that behavior will
   be checked against.
2. Convert `docs/INDUSTRY_GRIEVANCES.md`'s 25 researched entries into the typed
   `ShopGrievance[]` this schema defines — the research is already done and sourced,
   this is a data-modeling pass, not new research.
3. Only after the schemas exist: begin the golden vertical slice (§43), starting
   with extracting the existing cut/tool-wear/telemetry logic out of
   `manual-campaign.tsx` into `simulation-core`, since that extraction is the
   prerequisite for everything else in the spec.

This assessment intentionally stops here. Building simulation-core, the audio
engine, or the grievance engine in the same pass as this assessment would violate
§44's explicit instruction against large undifferentiated commits.
