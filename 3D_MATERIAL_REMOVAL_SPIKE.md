# 3D material-removal spike — findings

Throwaway technical spike, isolated from this app, to answer the question `RISKS.md`
and `FEATURE_INVENTORY.md` deliberately gate: before committing to 3D, can a browser
engine (Three.js/WebGL) actually do real-time material removal at a usable
resolution and framerate.

**Spike location:** `C:\Users\Akhanal\Documents\ADV-Game-3D-Spike` (separate repo,
separate `npm install`, does not touch this project). Vite + React + `@react-three/fiber`
+ `@react-three/drei`, matching this app's React stack so any reusable pieces port
over cleanly later. Blender assets (stock blank, end-mill tool, vise) generated
headless via `blender/spike_assets.py` and exported to GLB with Draco compression,
per the standard glTF web pipeline.

## The question

Represent the stock as a heightfield: a single `PlaneGeometry` whose vertex Y values
get lowered wherever the cutter passes, mirroring the deterministic 2D grid this app
already uses. Can that run in real time, and at what resolution does it stop being
real time?

## What was actually measured, and a correction mid-spike

The first pass through the in-browser demo produced numbers that looked great
(sub-millisecond cuts even at 256×256) — but they were wrong. The sandboxed preview
pane this was tested in doesn't composite frames, which triggers a genuine
`THREE.WebGLRenderer: Context Lost` in that environment; React Three Fiber's ref
never attached as a result, so the "benchmark" was silently calling into a `null`
ref via optional chaining and measuring nothing. Caught by adding a correctness
check (verify the surface actually got lower, not just that the call didn't throw)
and re-running the identical algorithm headless in Node against the real `three`
package (no GPU/display needed — it's typed-array math). That version is honest:

**Naive full-mesh scan** (`bench/cut-bench.mjs`) — every `cutAt` call scans *all*
vertices regardless of tool radius, then calls `geometry.computeVertexNormals()`
over the whole mesh:

| Grid | Vertices | ms / cut | % of 16.67ms frame budget |
| --- | --- | --- | --- |
| 32×32 | 1,024 | 0.16 | 1% |
| 128×128 | 16,384 | 1.79 | 11% |
| 256×256 | 65,536 | 7.26 | 44% |
| 384×384 | 147,456 | 16.17 | **97% — already over budget alone** |
| 512×512 | 262,144 | 33.34 | 200% |

This is the naive version most people would ship first, and it falls over well
before the resolution you'd actually want for a "positively received, accurate"
mill sim. It scans the whole mesh every time regardless of how small the cutter is.

**Bounded version** (`bench/cut-bench-optimized.mjs`) — a `PlaneGeometry`'s vertices
are a regular row-major grid, so a world-space radius converts directly to a
row/col index range without scanning anything outside it:

| Grid | Vertices | ms / cut (bounded) | one full normal recompute |
| --- | --- | --- | --- |
| 256×256 | 65,536 | 0.0054 | 10.86 ms |
| 512×512 | 262,144 | 0.0191 | 34.23 ms |
| 1024×1024 | 1,048,576 | 0.0811 | 111.2 ms |

The cut itself becomes a non-issue at any resolution worth considering. The
bottleneck moved entirely to `computeVertexNormals()`, which is still an O(total
vertices) pass regardless of how many vertices actually moved — that's now the
single most expensive thing in the loop, and it wasn't visible at all until the
cut cost stopped hiding it.

## Answer to "start 3D now, or wait"

**The engine is not the blocker.** A properly bounded heightfield update handles
real-time cutting at resolutions far beyond what this game needs (500×500+, with
headroom to spare) inside a plain Three.js/React Three Fiber scene — no case here
for jumping to Unity or UE5 on capability grounds. `src/HeightfieldStock.tsx` in the
spike now uses the bounded approach.

What *isn't* answered yet, and shouldn't be assumed away:

1. **Normal recomputation still needs the same bounded treatment** before this is
   real-time past ~200×200 — recompute normals only for the touched region plus a
   one-vertex ring, not the whole mesh. This is a known, solvable problem (it's the
   same class of fix as the cut itself), not an open research question.
2. **This spike never got a real on-screen FPS reading.** The sandbox's WebGL
   context loss blocked it. The CPU-side numbers above are solid and reproducible
   (`node bench/cut-bench-optimized.mjs`), but actual GPU frame time with the vise
   and tool GLB assets loaded, shadows on, and OrbitControls active has not been
   confirmed on a real display. Run `npm run dev` in
   `ADV-Game-3D-Spike` locally and watch the on-screen FPS counter (Space toggles
   the spindle, WASD/arrows jog, resolution buttons switch grid size) — that's a
   two-minute check, not a research question.
3. This still says nothing about whether 3D is the right *product* move yet — that
   part of `ROADMAP.md`'s gating (3D only after 2D retention proof) is a design
   judgment about player retention, not a technical one, and this spike doesn't
   change it either way.

## Recommendation

Don't let this spike's result pull the retention-gate work (three contracts, real
tool tradeoffs, active inspection) off course — it wasn't blocked on the engine
question in the first place. Keep this as a reference implementation to pull from
once the roadmap actually reaches the 3D gate: the bounded-cut pattern in
`HeightfieldStock.tsx` and the Blender→GLB pipeline in `blender/spike_assets.py`
are the two pieces worth carrying forward as-is.
