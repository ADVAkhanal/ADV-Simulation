# ADV-Simulation — Master Product Spec (Governing Document)

**Status: canonical.** This document supersedes `ROADMAP.md`'s framing wherever they
conflict — `ROADMAP.md` remains useful for phase sequencing and near-term priorities,
but this spec is the source of truth for product identity, architecture principles,
and the definition of done. Every future increment should be checked against this
document before merging.

This is not an arcade game. This is not a machine-control or toolpath-verification
product. This does not output authoritative machine-ready feeds, speeds, offsets,
controller procedures, or safety instructions. It is a high-fidelity training
environment that teaches operators how manufacturing systems behave, sound, degrade,
fail, recover, drift, and interact — while generating defensible evidence of learner
competency.

**Governing question for every feature:** *Does this help a buyer trust that the
learner is learning something that transfers to a real manufacturing environment?*

---

## 1. Product identity

**Audience:** CNC shops, manufacturers, trade schools, community colleges,
apprenticeship programs, workforce-development programs, internal corporate training
departments, machining instructors.

**Favor:** credibility, restraint, causal realism, traceability, repeatability,
measurable competency, generic/unbranded machinery, realistic terminology, authentic
shop friction, instructor utility.

**Reject:** arcade framing, cosmetic progression, memes, comedy mechanics, XP as the
primary competency measure, arbitrary random failures, fake "hard mode," exaggerated
crashes for spectacle, branded representations of real machines/controllers, claims
that the simulator verifies real-world machining safety or manufacturability.

## 2. Commercial/IP requirement — Phase 0

**Status: inspection complete, see `docs/ARCHITECTURE_ASSESSMENT.md`.** The
inherited-exposure list below was accurate for the raw AI-generated image batch this
project's art was sourced from, but a full scan of the 9 assets actually shipped in
`public/assets/` (plus a text/code grep) found zero legible trademarks in the
product itself. The scan is done; the automated CI check called for below is not
built yet.

Inspect the repository for visible or textual manufacturer trademarks and real model
identifiers before building new visual systems. Known inherited exposures: **KURT**,
**Mitutoyo**, **HAAS NGC**, **VF-750**. Search source code, UI strings, filenames,
image assets, SVGs, documentation, and sample machine configurations. Replace with
generic equivalents (e.g. "Production VMC 500," "5-Axis Trunnion 450," "CNC Turning
Center 250," "Wire EDM 400," "Manual Knee Mill," "Surface Grinder") unless explicitly
licensed. Do not merely obscure logos if the underlying imagery remains identifiable.
Maintain asset provenance. Build an automated forbidden-brand scan for distributable
assets and text.

## 3. Architecture principle — one truth model

Never build unrelated systems for audio, tool wear, surface finish, spindle load,
vibration, failure, dimensional drift, or inspection. All observable outcomes derive
from a shared underlying simulation state:

```
Operator Actions → Simulation Core → Physical/Latent State →
  { Machine response, Cutting forces, Tool wear, Vibration, Thermal behavior,
    Chip behavior, Part geometry, Surface condition, Machine telemetry,
    Acoustic synthesis, Failure progression }
```

A learner must never receive contradictory cues. If a tool is unstable, audio,
vibration, spindle load, and eventual surface finish should all reflect it together.

## 4. Package architecture

```
packages/
  simulation-core/   machine-model/   cutting-model/    tool-model/
  vibration-model/   thermal-model/   chip-model/        coolant-model/
  metrology-model/   failure-model/   procedural-audio/  telemetry/
  replay/            assessment/      curriculum/        instructor/
  units/             validation/
```

React/rendering/UI code must never determine machining truth. Prefer a deterministic
step API:

```ts
step(state, operatorAction, deltaTime): SimulationStepResult
// { nextState, observations, emittedEvents, assessmentEvidence }
```

## 5. Determinism

All assessment-relevant stochastic behavior uses seeded RNG. Record seed, simulator
version, simulation-core version, machine-profile version, scenario version, rubric
version, material-profile version, tool-profile version, configuration flags. Same
versions + same seed + same actions → same assessed outcome within documented
tolerance. Never call uncontrolled `Math.random()` inside assessed behavior.

## 6–20. Machine, tool, acoustic, chatter, and metrology models

*(Full detail preserved from the original spec — see sections 6 through 20 as
delivered. Summarized here for index purposes; do not re-derive from memory, treat
the original spec text as authoritative until this doc is split into per-model
validation records per §28.)*

- **Machine model (§6):** configurable profiles — architecture, axis count, travels,
  rigidity/damping, spindle power/torque, thermal characteristics, coolant/air
  capability, tool capacity, chip evacuation capability, age/condition state.
  Individuality emerges from engineering characteristics, not personality.
- **Tool model (§7):** latent states beyond a single health scalar — flank wear, edge
  condition/chipping/fracture, thermal damage, BUE tendency, coating degradation,
  runout contribution, accumulated exposure by material/interruption/thermal cycling.
- **Procedural acoustics (§8–10):** signature feature. Synthesis-first (oscillators,
  wavetables, filtered noise, resonators, modal filters, AM/FM, stochastic
  transients), not prerecorded samples. `tooth_pass_frequency = (RPM/60) × flutes`.
  Wear progression is acoustically gradual and causally derived from tool/cut state,
  never a hardcoded "danger sound." Different failure modes must sound different.
- **Chatter model (§11):** coupled machine/tool/workpiece instability depending on
  spindle speed, tooth-pass excitation, engagement, stickout, stiffness/damping
  chain. RPM, engagement, stickout, and workholding stiffness must each visibly
  matter — qualitative coherence, not universal predictive accuracy.
- **Audio must not leak hidden state directly (§12):** symptoms, not state readouts.
  Experts detect problems earlier than beginners because they read symptoms better,
  not because the game tells them more.
- **Metrology as an active system (§20):** resolution, uncertainty, calibration,
  zero error, measurement force, temperature, cleanliness, technique, and location
  all matter. The operator can mismeasure a good part. Reward sound practice, not
  just the final number.

## 13–19. Shop-grievance knowledge base

Research real machinist grievances (Practical Machinist, CNCZone, Reddit
r/machinists /r/CNC, manufacturer forums, trade publications) across: cutting,
tooling, workholding, chips, coolant, tool-changer/spindle, setup,
programming/control, material, metrology, thermal, maintenance, quality/
documentation, production/business friction. Classify every claim as *anecdotal →
repeated anecdotal → engineering-supported → validated* (§38) — never copy
proprietary text, always cite and summarize (§37).

`ShopGrievance` schema (§14) carries id, category, source references, trigger
conditions, latent-state effects, multi-channel observations (audio/visual/
telemetry/dimensional/process), progression stages, consequences, appropriate vs.
inappropriate responses, preventive behaviors, mapped competencies, severity tier,
optional seeded stochastic model, and validation status.

Prefer cascading/Swiss-cheese failure chains (§16) over isolated random failures.
Not every grievance should produce scrap — minor nuisances matter (§17) and should
be common; catastrophe should not be constant. Model realistic human-interruption
opportunities (§18) that a disciplined checklist prevents, rather than forcing
mistakes on the learner.

## 21–26. Training, competency, and instructor systems

- **Training modes (§21):** Guided / Supported / Independent / Assessment — not
  consumer difficulty labels. Assessment mode is fixed-scenario, deterministic,
  fixed-rubric, fully logged, reproducible.
- **Competency model (§22):** setup verification, datum establishment, tool
  selection/inspection, workholding verification, safe prove-out reasoning,
  abnormal-sound/chatter/wear recognition, coolant diagnosis, chip-management
  awareness, metrology selection/technique, tolerance interpretation, quality
  disposition, troubleshooting, process monitoring, maintenance awareness. External
  frameworks (O*NET etc.) map *onto* this model; they don't replace it.
- **Event telemetry (§23):** every assessment-relevant action recorded with
  versioned schemas, supporting deterministic replay.
- **Assessment model (§24):** multi-dimensional (safety/discipline, setup, process
  control, tool-condition recognition, troubleshooting, metrology, quality decision,
  efficiency). Critical mistakes can override aggregate score — a learner cannot
  buy back a critical procedural failure with points elsewhere.
- **Instructor dashboard (§25):** cohort view, competency mastery, repeated
  deficiencies, drill-down from aggregate ("7 learners weak in work-offset
  verification") to individual session timelines, and a "what actually happened vs.
  what the learner could observe" view — this comparison is a core teaching
  capability, not a nice-to-have.
- **Session reports (§26):** learner, scenario+version, simulator+rubric version,
  competencies, evidence, critical errors, interventions, attempts, result, replay
  ID. Call it a competency record / assessment report / completion record — never
  claim independent professional certification unless an external credentialing
  body actually provides it.

## 27–30. Engineering rigor

Comprehensive deterministic tests (§27) — same seed/config/actions → same outcome;
RPM=0 → tooth-pass frequency=0; increasing stickout must not increase stiffness;
tool fracture must immediately and coherently change acoustic + tooth-pass state;
unit round-trips must preserve value within tolerance. Add a regression test for
every bug found.

Every major model gets a validation record (§28): name, version, purpose,
assumptions, input range, source data, validated range, error metric, qualitative
expectations, known limitations, out-of-range behavior — and an explicit tag:
*physically modeled / empirically approximated / qualitatively modeled /
pedagogically simplified*. Never conceal simplifications.

Pilot validation (§29) compares simulator assessment against independently observed
instructor judgment — the real question is whether simulator performance correlates
with real operator competence, not whether it "feels realistic."

Realism effort ordering (§30): causal coherence → assessment validity → process
realism → sound/vibration realism → tooling behavior → metrology → machine behavior
→ shop friction → visual polish. Never trade simulation credibility for graphics.

## 31–36. UX, acoustic scenario design, environment, software quality, performance

Learner progression target (§31): Novice needs explicit warning → Beginner notices
alarm/load → Intermediate notices finish/load changes → Advanced hears and
recognizes abnormal cutting → Expert avoids creating the unstable condition.
Scenarios should be designed to measure this progression, and should require
corroboration across multiple unhealthy-sound scenarios (§32) — chatter, harmless
resonance, wear, recutting, coolant interruption, mechanical noise, edge damage —
so learners don't learn to react identically to every unusual sound.

Environmental realism (§33) — coolant mist, dirty windows, chip accumulation,
lighting, noise masking — must never glamorize unsafe conditions or make unsafe
behavior a requirement for success.

Software quality (§34): strict TypeScript, deterministic tests, schema versioning +
migration, error boundaries, audit logging, accessibility, keyboard navigation,
stable exports, secure identity handling, role separation, backup/export strategy,
dependency auditing, provenance records, CI, reproducible release builds. No major
feature is complete until tested.

Performance (§35–36): procedural audio must not destroy render performance —
separate audio synthesis rate, physics update rate, UI render rate, and telemetry
rate; avoid React state updates at audio sample frequency; consider AudioWorklet.
Build developer-only acoustic diagnostics (RPM, rotation/tooth-pass frequency,
resonance bands, chatter indicator, spectral state, deterministic playback of saved
states) so audio engineering is testable, not subjective.

## 39. Safety / claims

Never present as: machine certification software, CAM/NC verification, collision-
proofing, a substitute for machine manuals or shop procedures, a source of
universally safe feeds/speeds, or a source of authoritative controller procedures.
Use context-appropriate disclaimers without over-plastering every screen.

## 40. Definition of "10/10"

Physical coherence · acoustic credibility (experienced machinists recognize
meaningful sound-state transitions) · shop credibility (experienced operators
recognize the annoyances and failure chains) · educational validity · assessment
defensibility · reproducibility · traceability (requirement → implementation →
telemetry → assessment → report) · validation (assumptions/limitations documented)
· product safety (no overclaiming machine-level authority) · commercial quality
(reliable, accessible, maintainable, administratively useful).

## 41. Implementation order

Phase 0 De-risk → Phase 1 Instrument → Phase 2 Simulation truth layer → Phase 3
Procedural audio → Phase 4 Internal pilot → Phase 5 Competency assessment → Phase 6
Instructor environment → Phase 7 External validation → Phase 8 Productization.

## 42–43. First engineering deliverables & golden vertical slice

Before implementing hundreds of grievances, produce (in order): repository
architecture assessment, trademark/IP inventory, simulation-state schema, seeded-
event architecture, `MachineProfile` schema, `ToolState` schema, `AcousticState`
schema, `Grievance` schema, `Competency` schema, validation framework, and **one
complete vertical slice**: healthy cutter → wear progression → changing force →
changing telemetry → changing acoustic spectrum → onset of chatter → learner
recognition → intervention → changed outcome → inspection → competency assessment →
instructor replay. No giant flashing warning appears; a skilled learner hears the
change, checks corroborating telemetry, pauses, inspects, identifies the mechanism,
corrects it, resumes, inspects the part, and makes the correct disposition. Do this
one scenario extraordinarily well before adding shallow breadth.

## 44. Operating instruction

Do not implement everything in one giant commit. Per increment: inspect current
repo state → identify relevant existing systems → state the specific engineering
assumption → implement the smallest coherent architecture → add tests → run tests/
build → document model limitations → preserve determinism → verify no arcade tone
leaked in → verify no real brand exposure was introduced. When uncertain, prioritize
causal coherence, evidence, and professional credibility over feature count.

**The desired end state is not** "this looks like a CNC machine." **It is:** "an
experienced machinist recognizes the sounds, problems, tradeoffs, and habits; an
instructor can see whether the learner recognized and handled them correctly; and
the software can explain exactly why the simulated outcome occurred."
