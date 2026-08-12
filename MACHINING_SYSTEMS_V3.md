# Project Toolpath — Machining Systems v3

## Product intent

The machine is the game surface. The process map remains available as an analytical view, but the default flagship-contract loop now happens directly on the Three.js stock: establish the cell, start the spindle, guide the cutter, watch the material record the pass, and inspect the result in a dedicated metrology state.

## System boundary

- `manual-campaign-engine.ts` owns deterministic rules, stock cells, operations, tool compatibility, grading, inspection evidence, and progression.
- `manual-campaign.tsx` owns the run state and translates stock-grid state into presentation props.
- `three-machining-stage.tsx` owns rendering and spatial input. It does not grade the player.
- `machining-visual-systems.ts` owns camera presets, machine mood, surface response, and adaptive quality budgets.
- `flagship-machining-kit.tsx` owns loading, fallback selection, presentation labels, and the hero/full/mini variants.

## Implemented visual systems

| System | Player-facing behavior |
| --- | --- |
| Machine | Production GLB, moving spindle/tool assembly, distinct mounted tools, work lights |
| Camera | Establishing, operator, machining, macro-cut, datum, inspection, and failure states with damped transitions |
| Cutting | Stock raycasting maps the physical cursor hit to the deterministic 28 × 16 simulation grid |
| Toolpath | Completed trail plus high-contrast active segment positioned on the stock envelope |
| Chips | Material-aware instanced chip flight scaled by load and viewport quality budget |
| Coolant | Adaptive mist point field centered on the live tool |
| Surface | Removed cells become a dimensional relief layer; finish color/roughness respond to heat, load, and penalty |
| Load/damage | Lighting temperature, controlled vibration, and failure framing expose process strain without obscuring telemetry |
| Datum | G54 plane, XYZ axes, and work-origin marker are spatially anchored to the stock |
| Inspection | Dedicated metrology camera and animated scanner plane reinforce the evidence-gated inspection loop |
| Fallback | GLB load or WebGL-context failure returns to the deterministic Canvas 2D machine without breaking play |

## Interaction contract

- Left drag on visible stock: move/cut when cycle is active.
- Pointer hover on stock: cyan work-surface highlight.
- Right drag: orbit.
- Wheel: dolly.
- `3D CUT`: primary playable cell.
- `PROCESS MAP`: precise analytical fallback/control surface.
- `G54`: reveal work origin and axes.

## Performance policy

`qualityBudget()` caps device pixel ratio and scales chip/mist counts and shadows by viewport width. Particle systems are instanced or buffer-based. Geometry/material disposal is mandatory on teardown. Reduced-motion preferences disable automatic orbit. WebGL context loss activates the tested 2D fallback.

## Next high-value work

1. Replace cell-relief cuts with a worker-driven heightfield or signed-distance stock mesh while preserving deterministic grading.
2. Introduce spatial coolant collision and chip accumulation zones.
3. Add state-driven spindle/cutting/chatter audio loops with bounded gain and reduced-motion/accessibility equivalents.
4. Add GPU timing telemetry and quality-tier selection for low-power mobile devices.
5. Expand authored camera beats per operation and contract rather than adding free-floating spectacle.

