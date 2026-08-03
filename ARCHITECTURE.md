# Architecture

Current client: React 19 on Vinext, deployed as a Cloudflare-compatible Sites worker.

The game is structured around a serializable simulation state and deterministic functions for target geometry, cutting, scoring, and progression. Rendering and input are web-specific; rules and contract data are designed to move later into a shared TypeScript package.

Platform path:

1. Browser prototype validates feel and retention.
2. Desktop client adopts the shared simulation/content model and adds native input, Steam services, and higher-fidelity rendering/audio.
3. Meta Quest client reuses rules and contracts while replacing interaction and presentation with tracked tools, spatial UI, and VR-safe comfort design.

No Steamworks, multiplayer, accounts, cloud saves, or VR runtime is implemented yet.
