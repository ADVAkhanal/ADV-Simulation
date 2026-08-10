# Project Toolpath — Claude production handoff

Read this file before changing the game, its assets, or its deployment pipeline.

## Product boundary

Project Toolpath is a fictional browser-based precision-machining game. It is not machine-operating guidance, CAM software, certification, or a representation of a real shop inventory.

- Repository: `ADVAkhanal/ADV-Game`
- Production branch: `main`
- Deployment source: GitHub to Railway
- Never deploy or push this project to ChatGPT Sites.
- Never add real manufacturer branding, controller procedures, customer geometry, serial numbers, machine counts, locations, or production parameters.
- Do not claim parity with a native simulator until geometry-specific 3D stock deformation and collision semantics exist and are tested.

## Start here

```powershell
npm ci
npm test
```

`npm test` performs the production build and all regression tests. A change is not done if this command fails.

## Runtime architecture

| Surface | Primary files | Responsibility |
|---|---|---|
| Manual milling game | `app/manual-campaign.tsx`, `app/manual-campaign-engine.ts` | Contracts, cutting loop, scoring, progression |
| Live 3D Twin | `app/flagship-machining-kit.tsx` | GLB parsing, hierarchy transforms, projection, lighting, cut effects |
| 3D presentation | `app/flagship-machining-kit.module.css` | Twin labels and orbit controls |
| G-code game | `app/gcode/*`, `app/gcode-engine.ts` | Creative programming campaign |
| Tool Crib 3D view | `app/gcode/tool-crib-viewer.tsx` | GLB parsing/projection for the G//CODE Stage tool reference (reuses the Live 3D Twin's renderer approach, trimmed for a static inset) |
| Asset Lab | `app/lab/asset-pipeline/*` | Asset diagnostics and capability atlas |
| Global navigation | `app/mode-dock.tsx` | Manual mill, G-code, and Asset Lab routes |

The 3D Twin is a custom Canvas 2D software renderer. It does not currently use Three.js or WebGPU. It reads indexed triangle meshes, node hierarchy transforms, base-color factors, metallic values, and roughness values from the GLB.

Unsupported GLB features must not become release dependencies without first extending and testing the parser:

- texture samplers and UV-driven material maps;
- normal, occlusion, emissive, or roughness textures;
- skeletal animation and morph targets;
- transparent material sorting beyond the current face-depth pass;
- collision meshes or native boolean stock removal.

## 3D asset pipeline

### Authoritative files

- Procedural source: `tools/blender/build-machining-kit.py`
- Editable Blender source: `assets-src/blender/toolpath-machining-kit-v1.blend`
- Runtime GLB: `public/assets/workholding/toolpath-machining-kit-v1.glb`
- Integrity manifest: `public/assets/manifests/toolpath-machining-kit-v1.json`
- Asset contract test: `tests/machining-kit.test.mjs`
- Visual-QA renderer: `tools/blender/render-machining-kit-preview.py`

The Python build script is the primary source of reproducibility. Do not make an undocumented Blender-only edit that cannot be recreated by the script.

### Rebuild

Blender 5.2 LTS is the validated version.

```powershell
tools/blender/export-machining-kit.ps1
```

Equivalent direct command:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" `
  --background --python-exit-code 1 `
  --python tools/blender/build-machining-kit.py
```

The build must clear the scene, establish millimeter units, create stable semantic names, apply transforms, attach `toolpath.*` custom properties, validate release budgets, save the source blend, export the GLB, and regenerate the SHA-256 manifest.

### Coordinate contract

- Units: millimeters
- Blender world up: `+Z`
- Machine `X`: left/right
- Machine `Y`: front/back
- Machine `Z`: vertical
- Stock reference: top center
- Tool reference: cutter tip
- Spindle reference: tool anchor
- Fixture reference: stock anchor

Do not compensate for coordinate mistakes with arbitrary browser offsets. Fix the source transform or the documented runtime mapping.

### Naming contract

Production nodes use dot-separated semantic names, for example:

```text
machine.spindle.body
machine.spindle.toolholder
machine.coolant.manifold
fixture.vise.stock_anchor
tool.endmill.flat.010
stock.block.flagship
```

Rules:

- no default `Cube`, `Cylinder`, `Empty`, or `Plane` names;
- anchors must be empties with explicit `toolpath.anchor_role` values;
- movable objects must have `toolpath.movable = true`;
- every manifest object must exist exactly once in the GLB;
- update `EXPECTED_NAMES`, the manifest, and `tests/machining-kit.test.mjs` together.

### Current 3D release budget

- 22 named assemblies
- 11,516 triangles
- 7 materials
- 801,384-byte GLB
- hard ceiling: 40,000 triangles, 8 materials, 2 MB GLB

Stay under the hard ceilings. A larger budget requires a measured performance justification and test changes.

### Visual QA

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" `
  --background assets-src/blender/toolpath-machining-kit-v1.blend `
  --python-exit-code 1 `
  --python tools/blender/render-machining-kit-preview.py `
  -- build/machining-kit-preview.png
```

Review silhouette, enclosure visibility, fixture hierarchy, tool alignment, material separation, clipping, and accidental obstruction. This preview supplements the browser build; it does not replace runtime QA.

### Tool Crib v1 (G//CODE Stage)

A second, independent 3D asset with its own budget and manifest, modeled after real shop tool-crib management: a wall-mounted rack of six numbered sockets, each holding one cutter with a status band, rendered live in the G//CODE Stage workspace and highlighting whichever `T` number the active program has checked in.

- Procedural source: `tools/blender/build-tool-crib.py`
- Editable Blender source: `assets-src/blender/toolpath-tool-crib-v1.blend`
- Runtime GLB: `public/assets/workholding/toolpath-tool-crib-v1.glb`
- Integrity manifest: `public/assets/manifests/toolpath-tool-crib-v1.json`
- Asset contract test: `tests/tool-crib.test.mjs`
- Visual-QA renderer: `tools/blender/render-tool-crib-preview.py`
- Runtime viewer: `app/gcode/tool-crib-viewer.tsx` (fetches the GLB, projects it with the same face-lighting math as the Live 3D Twin, and glows whichever `toolcrib.slot.NN` / `tool.endmill.crib.NN` pair matches `parsed.state.tool`)

Naming contract: `toolcrib.cabinet.frame`, `toolcrib.cabinet.backplate`, `toolcrib.placard`, `toolcrib.slot.01`..`06`, `tool.endmill.crib.01`..`06`. Current budget: 15 named objects, 6,648 triangles, 6 materials, ~428 KB GLB — well under the shared hard ceiling (40,000 triangles / 8 materials / 2 MB).

```powershell
tools/blender/export-tool-crib.ps1
```

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" `
  --background "assets-src/blender/toolpath-tool-crib-v1.blend" `
  --python-exit-code 1 `
  --python tools/blender/render-tool-crib-preview.py `
  -- build/tool-crib-preview.png
```

## Live 3D effects contract

Runtime effects in `app/flagship-machining-kit.tsx` are derived from transformed GLB node centers and game state.

- cutter phase exists only while the spindle is active;
- coolant jets converge on the transformed cutter position;
- chip flight is deterministic and reduced in the mini viewer;
- warm/cyan cutting-zone light scales with simulated load;
- the machined floor grows from authoritative completion;
- reduced-motion mode freezes phase animation but preserves state information;
- entering the full 3D Twin forces spindle hold in the parent game.

Do not add screen-pinned effects that drift away during orbit or zoom.

## 2D art pipeline

### Source and runtime separation

- Full-resolution source masters: `assets-src/2d/`
- Optimized runtime images: `public/assets/2d/`
- Build script: `tools/assets/build-2d-art-pack.py`
- Manifest: `public/assets/manifests/toolpath-2d-art-pack-v1.json`
- Integrity test: `tests/2d-art-pack.test.mjs`

Never edit a compressed runtime WebP as the master. Make a new versioned PNG source and rebuild.

### Rebuild 2D assets

The script requires Python with Pillow:

```powershell
python tools/assets/build-2d-art-pack.py
```

The script resizes source PNGs, emits optimized WebP files, computes SHA-256 hashes, and writes a total payload manifest.

Current pack:

| ID | Runtime use |
|---|---|
| `contract.drive-plate` | Emergency Drive Plate contract card |
| `contract.orbital-rib` | Orbital structural rib contract card |
| `contract.sensor-bracket` | Sensor bracket contract card |
| `environment.night-shift-vmc` | Campaign/loading environment plate |
| `ui.achievement-atlas` | Twelve-emblem Shop Log atlas |

The three contract images are decorative material anchors. The deterministic `GeometryPreview` SVG remains overlaid and continues to define the contract silhouette.

### 2D art direction

- charcoal and gunmetal establish mass;
- brushed/machined silver communicates the workpiece;
- cyan is reserved for datum, active state, and coolant;
- amber is reserved for engagement, heat, or risk;
- avoid decorative neon, fantasy sparks, fake text, logos, and generic sci-fi HUDs;
- machining marks, bores, pockets, clamps, and material thickness must look mechanically plausible;
- generated images must be recorded in `ASSET_PROVENANCE.md`.

### Adding a 2D asset

1. create a versioned source file under `assets-src/2d/<family>/`;
2. add a stable record to `ASSETS` in `tools/assets/build-2d-art-pack.py`;
3. rebuild the pack;
4. add or update the consuming UI;
5. document provenance and intended use;
6. run `npm test` and `git diff --check`;
7. verify the manifest path, file size, dimensions, and hash.

## Validation and definition of done

Before committing:

```powershell
git diff --check
npm test
```

For 3D changes, also rebuild Blender and inspect the QA render. For 2D changes, rebuild the art pack and confirm every runtime image appears in its manifest.

A visual change is complete only when:

- source and runtime artifacts both exist;
- manifests and hashes match;
- tests pass;
- text remains readable at normal desktop zoom;
- buttons remain enabled and wired;
- reduced-motion behavior remains usable;
- fallback mode still works with `?assetFallback=1`;
- provenance and privacy boundaries are updated;
- Git contains no unrelated files, credentials, or local machine data.

## Delivery

Use scoped staging. Preserve unrelated work. Publish only when authorized.

```powershell
git status -sb
git diff --check
npm test
git add -- <explicit files>
git commit -m "<concise change>"
git push origin main
```

GitHub/Railway is the production route. Do not run a Sites-hosting deployment for this repository.

## Highest-value next work

1. geometry-specific 3D stock deformation tied to the authoritative cell grid;
2. collision semantics for tool, stock, fixture, and safe Z;
3. material-dependent chip forms and surface finish response;
4. true toolpath trails and replay camera beats;
5. browser and mobile visual QA after Railway deployment;
6. native-engine migration research only after the browser vertical slice is defensible.

