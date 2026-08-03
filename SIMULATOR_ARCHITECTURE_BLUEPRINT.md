# Simulator architecture adoption

This project adopts the attached next-generation CNC blueprint as a **long-horizon architecture**, while preserving the current game-first validation sequence.

## Product levels must remain explicit

| Level | Project Toolpath meaning | Current status |
| --- | --- | --- |
| Creative training | Simplified cause-and-effect lessons, fictional values, readable failures | Active browser prototypes |
| Geometric verification | Error-bounded motion, stock, collision, remaining material, traceable reports | Not built; no claims |
| Calibrated digital twin | Validated behavior for a specific machine/controller using measured data | Research horizon only |

The G//CODE Stage belongs to creative training. Its visual intensity must never imply controller compatibility or machine safety.

## Adopted architectural rule

Presentation clients do not own authoritative simulation.

```text
Source text
  -> lexer/parser and modal evaluation
  -> canonical commands with source provenance
  -> deterministic trajectory/events
  -> stock/collision/process kernels
  -> replay, diagnostics, inspection
  -> web, desktop, VR and instructor presentations
```

The first implementation of this boundary is `app/gcode/gcode-engine.ts`. It emits canonical motions and categorized diagnostics without React, DOM, rendering, frame timing, or randomness. The ASCII stage consumes its deterministic points as one presentation.

## Near-term TypeScript training kernel

Build only the subset needed for entertaining lessons:

- G00/G01, then G02/G03;
- G20/G21 and G90/G91;
- spindle state and feed values;
- source-line provenance;
- categorized diagnostics;
- deterministic event replay;
- golden-program tests;
- execution limits and coordinate bounds.

This kernel is not the future verification engine. It proves the canonical API, lesson design, diagnostics, and replay contract cheaply.

## Native-kernel trigger

Begin the proposed C++20 kernel only after the game demonstrates repeat use and the product chooses verification as a funded scope. Its technical proof is:

- one three-axis machine;
- G00/G01/G02/G03;
- work and tool-length offsets;
- one cutter and stock block;
- source-to-motion traceability;
- basic continuous collision;
- identical final stock checksum across repeated runs.

The native kernel must be independent of Unity/Unreal frame rate and callable through a stable boundary. A future Unity, desktop, web viewer, and OpenXR client must consume the same authoritative events.

## Deferred industrial scope

Do not prematurely build controller-identical proprietary dialects, arbitrary machine control, global sub-micron stock, full process finite-element analysis, five-axis kinematics, cloud-only customer-data handling, digital-twin writeback, or industrial safety claims.

## Trust requirements

- Every command, diagnostic, collision, and measurement retains source provenance.
- Compatible subsets and validated profiles use different labels.
- AI may explain findings but cannot certify safety.
- Rendering effects never alter authoritative results.
- Real-machine connectivity begins read-only and requires separate security, legal, domain, and validation work.
- Licensing and software-bill-of-materials review begin before any industrial dependency is embedded.
