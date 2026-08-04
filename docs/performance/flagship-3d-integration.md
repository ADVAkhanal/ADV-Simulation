# Flagship 3D integration

The Emergency Drive Plate is the only contract bound to Machining Kit v1. Its existing grid simulation remains the source of truth. The 3D inset is an explanatory instrument: it decodes the exported GLB, traverses its node hierarchy, projects the real triangles, and binds cursor, spindle, stock-completion, and load signals to presentation.

Failure lifecycle:

1. Fetch begins when the flagship play surface mounts.
2. A valid GLB changes the indicator from `DECODING` to `LIVE GLB` and records an anonymous local `asset_ready` event.
3. Invalid header, empty geometry, HTTP failure, or `?assetFallback=1` changes the indicator to `SAFE FALLBACK`.
4. The fallback draws simplified table, vise, stock, and spindle geometry while the authoritative game remains interactive.
5. Unmount aborts the request and cancels the animation frame.

The basic analytics buffer is device-local, capped at 100 coarse events, and contains no account, IP address, free text, inventory, or persistent identity. It measures the demo funnel, retry readiness, score outcomes, result sharing, and asset/fallback state.
