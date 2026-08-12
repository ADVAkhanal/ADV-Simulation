# Three.js systems integration

Project Toolpath adapts selected architectural ideas from Achref Elouafi's public Three.js experiments. It does not vendor those repositories or pretend that weather and combat demos belong in a CNC simulator.

## What was adapted

- **Procedural environment composition:** the machine stage builds a restrained shop bay around the authored VMC asset, using `InstancedMesh` for repeated columns and luminaires. This follows the procedural/instanced approach demonstrated across BuildingGeneratorThreeJS and VegetationGeneratorThreeJS.
- **GPU-friendly particle fields:** SnowSystemThreeJS and RainSystemThreeJS informed the reusable field model. In Toolpath the field has a domain-correct purpose: metallic chips and coolant mist emitted from the active cutter.
- **Event-focused visual feedback:** the casting-system repositories informed the separation between an action, its short-lived effect, and its renderer. Here the “cast” is a cut event, represented by a contact ring, rotating tool, chips, coolant, and work light response.
- **Real runtime integration:** Three.js and `GLTFLoader` now render the existing production GLB with physically based materials, shadows, fog, tone mapping, orbit controls, visible tool changes, and an instanced material-removal layer.

## Boundaries

- No source files, textures, shaders, models, or brands from the reference repositories are bundled.
- The implementation is original and CNC-specific. The references are MIT-licensed architectural inspiration.
- The existing deterministic machining engine remains authoritative. Visual effects never change score, collision, tolerance, or contract state.
- The pre-existing Canvas 2D GLB renderer remains the safe fallback for WebGL or asset-load failure.

## Runtime map

`ManualCampaign -> FlagshipMachiningKit -> ThreeMachiningStage -> GLTFLoader + procedural environment + instanced effects`

The component is intentionally isolated so a future renderer can add post-processing, compressed textures, LODs, or WebXR without coupling those concerns to campaign rules.

## Verification

- `npm run build`
- `npm test`
- `npm run lint`
- Test `/?assetFallback=1` to verify the non-WebGL path remains available.

## References

- https://github.com/achrefelouafi/BuildingGeneratorThreeJS
- https://github.com/achrefelouafi/VegetationGeneratorThreeJS
- https://github.com/achrefelouafi/SnowSystemThreeJS
- https://github.com/achrefelouafi/RainSystemThreeJS
- https://github.com/achrefelouafi/AvatarCastingAbilitiesThreeJS
- https://github.com/achrefelouafi/LinearAbiltyCastingThreeJS

