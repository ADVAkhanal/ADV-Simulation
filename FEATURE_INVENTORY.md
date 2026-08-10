# Feature inventory

Status legend: **shipped**, **next**, **later**, **gated**.

## Core play

| Feature | Status | Evidence / gate |
| --- | --- | --- |
| Pointer/touch material removal | shipped | Emergency Drive Plate vertical slice |
| Keyboard jogging | shipped | WASD/arrows with precision modifier |
| G//CODE Stage creative coding module | shipped | Simplified G-code becomes scored kinetic ASCII art |
| Blueprint keep-zone and overcut | shipped | Deterministic grid simulation |
| Feed, load, heat, wear, chatter, breakage | shipped | Live telemetry and failure feedback |
| Inspection, grade, payout, instant retry | shipped | Evidence-based accept/rework/scrap result loop |
| Controller input | next | Required for desktop foundation |
| Tool selection with real tradeoffs | shipped | Finisher, rougher, and drill have enforced capabilities, access limits, load, wear, removal, and finish behavior |
| Multiple operations: profile, pocket, drill, finish | shipped | Ordered operation plans, progress gates, and signoff across three contracts |
| Active inspection characteristics and measurement choices | shipped | Characteristic/instrument selection, tolerance readings, findings, and blocked invalid dispositions |
| 3D material removal | gated | Only after 2D retention proof |

## Progression and content

| Feature | Status | Evidence / gate |
| --- | --- | --- |
| Device-local credits, mastery, contract count | shipped | Migrated prototype save v3 |
| Contract ladder | shipped | Three authored contracts with sequential unlock and retry/advance |
| Machine/tool unlocks | next | No strict linear upgrades |
| Data-driven contract schema | shipped | Contract, operation, tool, and inspection rules validate without renderer |
| Deterministic daily challenge | later | After schema and seed tests |
| Workshop customization | later | After progression economy is tuned |
| Job board, scheduling, cost, and reputation | later | Add only after the three-contract machining loop validates |
| Unlockable shop knowledge codex | later | Fictionalized game guidance until professionally reviewed |

## Social and platforms

| Feature | Status | Evidence / gate |
| --- | --- | --- |
| Browser, pointer, touch, keyboard | shipped | Private Sites build |
| Shareable score/result card | later | Before leaderboard |
| Challenge seed/code | later | Before realtime networking |
| Ghost/toolpath comparison | later | Requires deterministic replay format |
| Peer-to-peer co-op | gated | Solo retention plus synchronization proof |
| Steam demo | gated | Controller-first desktop slice |
| Meta Quest/OpenXR prototype | gated | Desktop loop and performance budget |
| Professional training mode | gated | Requires validated data, provenance, review, and separate product scope |

## Quality and operations

| Feature | Status | Evidence / gate |
| --- | --- | --- |
| Build-backed regression tests | shipped | Current test suite |
| Reduced-motion and muted-audio paths | shipped | Prototype UI |
| Direct visual/browser release pass | next | Required every release candidate |
| Save migrations | shipped | v2 progress migrates to v3 mastery without losing credits or clears |
| Consented playtest measurement | next | Manual first; no production telemetry |
| Accessibility review beyond input parity | later | Before public demo |
