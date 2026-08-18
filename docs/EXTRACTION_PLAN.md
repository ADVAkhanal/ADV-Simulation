# simulation-core extraction plan

Concrete plan for the next increment named in `ARCHITECTURE_ASSESSMENT.md`:
extracting the cutting/tool-wear/telemetry logic in `app/manual-campaign.tsx` and
`app/manual-campaign-engine.ts` into `packages/simulation-core`'s `step()` API.
Written before touching the code, per §44 - this is genuinely delicate, tuned,
working gameplay, and a rushed extraction risks breaking feel that took real
iteration to get right.

## What's better than expected

`manual-campaign-engine.ts`'s `machineManualStock()` (line 214) is **already a pure
function** - grid-based material removal with no React state touched, taking
`(source, finishSource, contract, operation, tool, cutterX, cutterY)` and returning
`{ material, finished, correct, overcut, engagement, mismatch, fixtureStrikes,
compatible }`. This is a legitimate, already-separated piece of simulation truth.
The extraction is not "everything is tangled," it's specifically:

## What's actually entangled

In `manual-campaign.tsx`, inside the React component itself (not the engine file):

| State | Line | How it's currently computed |
|---|---|---|
| `condition` (tool wear, 0-100) | ~453-460 | Inline in a `setCondition` callback: `value + Math.max(0, nextLoad - 82) * .018 * tool.finish + cut.overcut * .25`, decremented every cut based on load and overcut |
| `heat` | ~204, ~452 | Inline cooldown in a `useEffect` interval (`value - (spindle ? 0.35 : 2.4)`) plus a per-cut gain term |
| `load` | ~205, ~428 | Inline cooldown (`value - 4` per tick) plus `nextLoad` computed per cut from `cut.engagement`/tool params |
| `overcut`, `fixtureStrikes`, `breaks` | ~428, ~453-455 | Accumulated directly from `machineManualStock()`'s return value via `setOvercut`/`setFixtureStrikes`, and `breaks` incremented inline when `condition` crosses 0 |
| Acoustic feedback | ~424 | A single `tone(cut.overcut ? 92 : 230 + nextLoad * 2.2, ...)` call - literally the "hardcoded danger sound" pattern §12 prohibits, though at a much smaller scale than the full procedural-audio vision |

All of this lives as five independent `useState` primitives with no single
`SimulationState` object, no `step()` boundary, and no event log - every mutation
happens as a direct `setX()` call inside the pointer-move handler.

## Proposed mapping to existing schemas

| Current (manual-campaign.tsx) | Target (simulation-core / tool-model) |
|---|---|
| `condition: number` (0-100 scalar) | `ToolState.flankWearMm` + `ToolState.edgeCondition` - this is the real fidelity upgrade §7 asks for, not a like-for-like port. The existing single scalar collapses distinct failure modes (gradual wear vs. a fixture-strike chip) into one number; splitting it is the actual point of the tool-model package. |
| `heat: number` | `ThermalState.spindleTemperatureC` / `ThermalState.workpieceTemperatureC` (simulation-core) |
| `load: number` | `CuttingState.spindleLoadFraction` (simulation-core) |
| `overcut`, `fixtureStrikes` counters | `emittedEvents` (telemetry) - these are discrete occurrences, not continuous state; per §23 they belong in the event log, with the *running counts* derived from the log rather than stored separately |
| The inline `tone(...)` call | Stays as-is for now. Building it out into real `AcousticState`-driven synthesis (§8-10) is its own increment, once `CuttingState`/`ToolState` are actually flowing through a real `step()` - synthesizing against schema fields nothing populates yet would be guessing, not implementing. |
| `machineManualStock()` | Keep as-is, called from within the new `step()` implementation. It's already the right shape; it just needs to become one of several things `step()` calls rather than something the component calls directly. |

## Recommended sequencing for the actual extraction

1. Implement `step()` in `simulation-core` calling the existing (unmodified)
   `machineManualStock()` for material removal, plus a new tool-wear/thermal update
   function that starts as a **direct port** of the current inline formula (same
   constants, `.018 * tool.finish + cut.overcut * .25` etc.) - preserve feel exactly
   on the first pass, decompose fidelity in a later increment. Changing the tuning
   and changing the architecture in the same commit makes a regression
   unattributable to either cause.
2. Add a test asserting the ported function produces bit-identical output to the
   current inline formula for a fixed set of inputs, captured *before* touching
   `manual-campaign.tsx` - this is the regression safety net.
3. Only then change `manual-campaign.tsx` to call `step()` and read `nextState`
   instead of managing the five `useState` primitives directly. Keep the
   component's rendering and input-handling code as untouched as possible in this
   pass.
4. Verify in-browser per the standard workflow (dev server, play a contract
   start-to-finish, confirm identical feel) before considering this increment
   done - this is exactly the kind of change where "it builds and tests pass" is
   not sufficient proof nothing broke, because tuned game feel is not something
   the existing test suite measures.
5. Only after that lands: begin wiring `ShopGrievance` trigger conditions against
   the now-real `SimulationState`, and only after *that*: begin the actual
   procedural-audio synthesis work, since it needs real `CuttingState`/`ToolState`
   values to react to.

## Why this wasn't started in this same increment

Per §44's operating instruction and the general engineering-safety principle of
matching action to reversibility: this is tuned, working, shipped gameplay, not a
green-field system. A rushed extraction risks a "builds and tests pass" change that
quietly feels worse to play - the kind of regression this repo's own test suite
cannot detect. Scoping it precisely now means the actual extraction, whenever it
happens, is a bounded, verifiable operation instead of an improvised one.
