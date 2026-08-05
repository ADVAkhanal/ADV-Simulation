# Asset pipeline README

This folder documents Project Toolpath's asset pipeline. Claude and other coding agents must read the repository-root [CLAUDE.md](../../CLAUDE.md) before changing assets.

## Canonical workflow

```text
versioned source master
  -> repository build script
  -> optimized runtime artifact
  -> SHA-256 manifest
  -> integrity test
  -> consuming UI
  -> production build
  -> GitHub main
  -> Railway
```

For 3D, start with [machining-kit-v1.md](machining-kit-v1.md) and `tools/blender/build-machining-kit.py`.

For 2D, start with `tools/assets/build-2d-art-pack.py` and `public/assets/manifests/toolpath-2d-art-pack-v1.json`.

Do not bypass source masters, manifests, tests, provenance, privacy boundaries, or the GitHub/Railway delivery rule.

