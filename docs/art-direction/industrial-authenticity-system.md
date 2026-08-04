# Industrial authenticity system

Project Toolpath uses measurable industrial and geometric constraints instead of decorative “tech” styling.

## Spatial system

- Primary spacing follows the Fibonacci sequence: 8, 13, 21, 34, and 55 px.
- Hero and primary workspace proportions use the golden ratio, 1.618:1.
- The playable 240 × 140 mm stock is drawn at exactly 4 px/mm: 960 × 560 px.
- The canvas rulers use 10 mm minor divisions and 50 mm labeled divisions.
- The main workspace gives the machine viewport 1.618 times the visual weight of a setup rail.

## Machining references

- Work coordinates are presented in millimeters against a fictional G54 datum.
- The stock, vise jaws, parallels, spindle, cutter, enclosure, and T-slot table establish physical hierarchy.
- The simulated path is rendered continuously over the authoritative cell model.
- Brushed grain, cavity floors, edge witness lines, coolant, chips, and cutter load are state-driven.
- Surface roughness and material-removal readings are explicitly labeled as simulation estimates.
- Live kinematic overlays communicate orthogonal centerlines, radial engagement angle, and a tangential force vector at the cutter.
- Simulated spindle speed, feed rate, feed per tooth, and engagement are derived consistently from the selected material, tool, and feed override.

## Visual doctrine

- Datum, engagement, and surface finish form the three-part visual narrative on the public landing screen.
- Machine callouts label the spindle axis, work offset, and fixture datum without relying on brand marks or decorative diagrams.
- Amber means physical engagement or force. It is not reused as ambient decoration.
- Technical annotations remain secondary to the machine silhouette and use hairline rules, compact labels, and explicit units.

## Machine rendering

- The GLB viewer calculates per-face normals and applies a consistent three-quarter inspection light.
- Metallic and roughness values from the asset influence highlight strength and technical edge weight.
- Perspective floor lines, a contact shadow, depth attenuation, and a controlled vignette ground the machine in a coherent volume.
- Camera motion is limited to a subtle idle inspection orbit and stops while the spindle is active.
- The renderer avoids noisy full-strength wireframes; edges remain subordinate to form and material value.

## Inspection payoff

- Result hierarchy follows a 1:1.618 split between verdict and dimensional evidence.
- The report reuses the contract geometry and adds a G54 datum frame, profile field, and four measured performance bands.
- Geometry, remaining material, simulated surface finish, and cycle performance each retain their own unit-bearing readout.
- Program, material, work offset, tool, and trace state provide a compact fictional traceability record.
- Accepted and rework states alter the inspection color system without changing layout, preserving instant comparison and retry speed.

## Progressive explanation

- Public labels are Easy, Medium, and Hard; no age or intelligence labels are shown.
- Easy explains the visible goal and immediate feedback in concrete language.
- Medium introduces tool choice, radial engagement, load, heat, and roughing-versus-finishing strategy.
- Hard exposes the simulation's quantitative relationships, including derived chip load, tangential force, and independent inspection signals.
- The selected learning lens changes explanation only. Contract geometry, scoring, and challenge remain identical.
- Players may change depth before a contract or inside the machine cell without restarting.

## Shop skill ladder

- Progression is derived only from saved personal-best scores, preventing repetitive low-quality runs from grinding advancement.
- Four independent signals are retained: geometry control, inspection discipline, process control, and cycle discipline.
- Role alignment follows current O*NET occupational families for CNC tool operators (51-9161.00), machinists (51-4041.00), and CNC tool programmers (51-9162.00).
- The ladder communicates role awareness, not qualification, certification, safety readiness, or employability.
- Real advancement still requires supervised shop training, safety instruction, hands-on measurement, credentials where applicable, and employer evaluation.
- Automation, SCADA/PLC systems, and external business-deal mechanics are explicitly deferred; this release remains focused on machining, inspection, 3D assets, and the core play loop.

## Shop log

- Every inspection creates a device-local run record, including accepted and rework outcomes; the ledger retains the latest 24 runs.
- Career XP remains personal-best-only, so the review history cannot be used to grind role progression.
- The log combines current role alignment, four skill signals, contract releases, average best score, milestone plates, and filterable run evidence.
- Milestones reward first inspection, first release, contract breadth, precision, finish control, and S-rank performance.
- No account, cloud identity, public leaderboard, employment record, or certification claim is created.

## Full-frame 3D twin

- The machine cell provides two explicit views: the authoritative interactive Cut Map and a full-frame 3D Twin review.
- The twin uses the same live GLB fixture, spindle, cutter, and stock assets as the landing-stage renderer.
- Current XY coordinates, tool selection, fixture stack, completion, and process state remain visible in the 3D review.
- Entering the twin forces spindle hold and zero displayed load; machining cannot continue behind the 3D layer.
- Cycle Start from the twin returns to the Cut Map before any cutting state can resume.
- The 3D twin is a visual fixture/process review, not a collision-verified manufacturing simulation.

## Typography and color

- Display type is condensed and low-tracking; machine data uses the mono family.
- Body copy uses a minimum 1.55 line-height and restrained width.
- Cyan is reserved for active datum, tool, and process state; red is reserved for overcut and alarms; amber is reserved for safety.
- Most hierarchy comes from proportion, luminance, metal value, and line weight—not glow.

## Public defensibility

The visuals contain no real manufacturer marks, exact machine inventory, customer information, controller procedures, or production parameters. Every process value is fictional or labeled as a simulation estimate. The game is not machine-operating guidance.

## Shop-threshold key art

The landing hero now uses one authored cinematic machining plate as a material anchor. Its role is to communicate mass, surface, fixture discipline, and enclosure depth before the player enters the abstracted simulation. Measured G54 reticles, restrained captions, a four-signal evidence rail, and an explicit representative-game-world label keep the image inside the same technical grammar as the live GLB renderer. Cyan remains a status/datum color; amber appears only as a small fresh-chip accent.

## First-article contract plates

Contract selection treats each job as a manufactured artifact rather than a generic game tile. The deterministic target geometry remains authoritative, but layered depth, contact shadow, surface response, datum reticles, stock form, simulated finish, route, and program identity give each part its own physical reading. The 6061 drive plate is cool and bright, the 7075 rib is neutral with a restrained lime process signal, and the titanium bracket is darker with a muted violet response. Anime.js provides a short staged hero reveal only when reduced motion is not requested; hover movement is similarly removed under the reduced-motion preference.

## Interactive 3D and readable instrumentation

The full-frame 3D Twin now prioritizes physical comprehension over passive presentation. It continuously orbits at a restrained speed, supports direct pointer orbit and wheel zoom, exposes pause/reset controls, honors reduced-motion preferences, and retains the existing safe-hold behavior. Increased ambient contribution, material overrides for stock/fixture/spindle families, stronger edge separation, and a larger projection make the assembly legible against the enclosure rather than disappearing into black.

Primary machine-cell text no longer depends on 6–9 px microtype at desktop widths. Contract, setup, controls, coordinates, process estimates, telemetry, and twin callouts use a larger calibrated scale while secondary metadata remains compact. A persistent Help / Tour control provides six contextual steps and highlights navigation, contract, setup, interactive 3D, telemetry, and inspection without hiding the actual interface.
