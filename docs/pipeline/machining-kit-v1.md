# Machining Kit v1

The first production machining asset kit is a modular, privacy-safe vertical slice for the Emergency Drive Plate contract. It contains a table, spindle body, tool anchor, vise body, fixed and moving jaws, stock anchor, 10 mm flat end mill, and flagship stock block. It intentionally contains no manufacturer marks, controller UI, serial numbers, quantities, locations, or exact shop inventory.

Source: `assets-src/blender/toolpath-machining-kit-v1.blend`

Rebuild with Blender 5.2 LTS:

```powershell
tools/blender/export-machining-kit.ps1
```

The build script sets units, creates stable object and mesh names, applies transforms, assigns the six approved materials, writes `toolpath.*` custom properties, validates release budgets, saves the source file, exports the GLB, and writes a hash-bearing manifest. The exported artifact is deterministic in structure; timestamp and Blender binary serialization may vary.

The Asset Lab exposes the kit, its object list, bounds, payload, and anchor contract. Add `?assetFallback=1` to the flagship URL to exercise the safe procedural fallback.
