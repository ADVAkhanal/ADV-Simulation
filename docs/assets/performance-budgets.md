# 3D performance budgets

Machining Kit v1 release gates:

- 40,000 triangles maximum; current manifest: 2,012.
- 8 materials maximum; current manifest: 6.
- 2 MiB GLB maximum; current manifest: approximately 138 KiB.
- One network request when the flagship play surface mounts.
- Device pixel ratio capped at 2 for the software-rendered inset.
- Animation frame and network request cancelled on unmount.
- A failed or deliberately disabled 3D asset must preserve controls, cutting, scoring, retry, and progression.

The integrity test derives triangle count from GLB accessors and verifies payload bytes and SHA-256 against the manifest.
