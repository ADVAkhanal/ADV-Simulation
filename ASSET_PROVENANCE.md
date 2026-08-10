# Asset provenance

The gameplay surfaces use code-rendered canvas/UI visuals, bundled fonts resolved by the existing framework, synthesized Web Audio, and Lucide icons under their package license. `assets/provenance.json` is the machine-readable release gate used by the game-factory pipeline (`tools/game-factory.mjs`): a file marked as used cannot ship unless it is also approved.

The Asset Lab also uses original procedural geometry generated in Blender 5.2 by repository-owned Python scripts. The source `.blend`, exported GLBs, SHA-256 hashes, and runtime manifest are checked into the project together. No downloaded machine models, manufacturer CAD, controller likenesses, or third-party textures are included.

## Generated key art

- `public/assets/keyart/toolpath-cnc-keyart-v1.webp` is original AI-generated cinematic key art created for this project with OpenAI's built-in image generation tool on 2026-08-04.
- The production prompt specified a fictional three-axis VMC interior, 6061 aluminum fixture plate, carbide flat end mill, vise/parallels, coolant mist, truthful metal response, and left-side copy space.
- The prompt explicitly excluded manufacturer branding, identifiable inventory, people, text, unsafe exposed cutting, sparks, sci-fi holograms, and impossible machine geometry.
- The source PNG was converted to an optimized WebP for runtime delivery. The image is labeled in-product as representative game-world key art, not a live camera, customer part, or real facility.

## VMC visual-development reference

- `docs/art-direction/references/vmc-cell-visual-development-v1.png` is an original AI-generated visual-development plate created with OpenAI's built-in image generation tool on 2026-08-04.
- It is a non-runtime art-direction reference for enclosure mass, open-door silhouette, workholding hierarchy, charcoal/steel material separation, restrained cyan status light, and warm cutting-zone light.
- The prompt excluded brands, people, readable text, real inventory, customer parts, unsafe sparks, and impossible machine geometry.
- The playable machine remains repository-owned procedural Blender geometry. No image-derived geometry, manufacturer CAD, or third-party textures are bundled in the GLB.

## 2D production art pack v1

- Five original images were created with OpenAI's built-in image generation tool on 2026-08-05: three fictional first-article contract portraits, one night-shift VMC environment plate, and one twelve-emblem achievement atlas.
- Full-resolution PNG masters live under `assets-src/2d/`; optimized runtime WebP derivatives live under `public/assets/2d/` and are hash-registered in `public/assets/manifests/toolpath-2d-art-pack-v1.json`.
- Prompts required original, technically plausible machining forms and excluded readable text, logos, people, real brands, customer geometry, identifiable inventory, unsafe sparks, impossible machinery, and watermarks.
- The contract portraits provide material and depth reference only. Deterministic contract geometry remains overlaid and authoritative for gameplay.
- The environment plate is representative game-world artwork, not a real facility photograph. The achievement atlas contains symbols only and makes no certification claim.

No prior company photographs are used by the playable surface. The machine capability kit is deliberately fictional and communicates process categories without claiming or revealing actual company inventory. Any repository image not yet wired into a shipped surface is listed as unused, unapproved, and `[VERIFY]` in `assets/provenance.json` so the game factory can distinguish dormant files from release assets.
