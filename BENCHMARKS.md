# Product benchmark: Krool World portfolio

This benchmark uses the products shown in the supplied Reddit screenshots and the developer's public portfolio. It benchmarks **shipping discipline and product shape**, not proven commercial success. Public store data is too limited to claim product-market fit.

Primary reference: https://krool.github.io/

Adjacent CNC, machinist-utility, aerospace-quality, and shop-management products are analyzed in `MARKET_LANDSCAPE.md`. They define the domain opportunity; this document defines the small-team shipping standard.

## What the portfolio does well

| Product | Strong product move | Project Toolpath translation |
| --- | --- | --- |
| Lanecraft | One clear RTS promise, then depth through factions, upgrade paths, difficulty levels, AI, and friend codes | One clear machining promise, then depth through materials, machines, tools, tolerances, and contract tiers |
| Dive Dude 2 | One-tap comprehension, short races, characters, leaderboards, immediate rematch | Start cutting in seconds, finish a contract in 1–3 minutes, chase grades, rematch instantly |
| Combo Ace | A scalable level ladder, three-star mastery, varied board geometry, strong feedback | Contract worlds, S/A/B mastery, distinct part geometry, explicit inspection feedback |
| Sling Party | Tactile core action plus classes, relics, and peer-to-peer co-op | Tactile cutting plus machine/tool loadouts and later cooperative job-shop roles |
| Friend Soccer | Browser-first, no download, simple controls, quick friend matches | Instant browser trial with pointer/touch/keyboard; shareable challenge seeds before live multiplayer |
| SuperSmashTexty | Procedural runs, cash, upgrades, class unlocks, co-op | Seeded rush jobs, credits, tool upgrades, machine unlocks, eventual team contracts |
| Roguecraft | Mobile web/PWA reach, weapon evolutions, replayable waves, P2P co-op | Installable offline-capable web demo, tool/process evolutions, escalating production runs |

## Portfolio-level pattern

1. The pitch fits in one sentence.
2. The first interaction is obvious and satisfying.
3. Sessions are short enough to restart immediately.
4. Content is produced from reusable systems, not bespoke one-off scenes.
5. Depth comes from combinations: character × item, faction × upgrade, tool × material × geometry.
6. Multiplayer is additive; the solo loop stands on its own.
7. Web/mobile distribution lowers the cost of trying the product.

## Standard for Project Toolpath

- **10 seconds:** understand “remove stock, protect the blueprint.”
- **60 seconds:** experience a clean cut, a warning, and visible progress.
- **3 minutes:** inspect a part, receive a grade and payout, and restart or advance.
- **3 replay reasons:** improve grade, unlock capability, try a different process.
- **1 sentence:** “Machine valuable parts under pressure, master the process, and grow your shop.”

## Near-term benchmark slice

Ship three replayable contracts before adding 3D or networking:

1. **Emergency Drive Plate** — profile cutting and dimensional discipline.
2. **Hydraulic Manifold** — pockets, heat management, and tool choice.
3. **Aerospace Bracket** — thin-wall risk, finish quality, and staged inspection.

Add three tool identities rather than linear stat upgrades:

- Roughing end mill: fast removal, rough finish, high load.
- Finishing end mill: slow removal, high finish ceiling, fragile under overload.
- Adaptive cutter: forgiving load, premium replacement cost.

## Explicit non-goals for this milestone

- No realtime multiplayer before the solo loop produces voluntary retries.
- No VR production before tools, materials, and scoring are renderer-independent.
- No large content count before the contract schema can generate and validate variants.
- No leaderboard before deterministic runs and basic anti-cheat boundaries exist.

## Process benchmark from the Reddit discussion

- Inventory features before refactoring.
- Maintain architecture and product documents.
- Work in task-sized vertical slices.
- Require unit, integration, regression, and visual checks appropriate to the change.
- Inspect UI state directly when visual behavior changes.
