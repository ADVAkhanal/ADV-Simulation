# Machine capability kit

## Purpose

The kit gives Project Toolpath a visual machine vocabulary without reproducing or disclosing a real shop inventory. Every model is a fictional capability archetype built from simple procedural forms.

## Privacy boundary

The assets must never encode or imply:

- manufacturer or product identity;
- exact model or controller family;
- machine quantity, location, age, condition, or utilization;
- serial, asset, network, or maintenance identifiers;
- a claim that a represented machine exists at a specific facility.

## Archetypes

| Asset | Process concept | Training emphasis |
| --- | --- | --- |
| Foundation Manual Mill | Hand-fed three-axis milling | Workholding, edge finding, feed feel, coordination |
| Vertical 3-Axis Cell | CNC vertical machining | Datums, tool offsets, cycle planning, inspection loops |
| Trunnion 5-Axis Cell | Simultaneous multi-axis milling | Rotary transforms, reachability, collision envelopes, setup reduction |
| Horizontal Turning Cell | CNC turning | Work zero, diameter control, chuck clearance, sequencing |
| Wire EDM Cell | Wire electrical discharge machining | Wire paths, flushing, taper control, delicate geometry |

## Reproduction

Run `tools/blender/export-machine-kit.ps1`. The script rebuilds `assets-src/blender/toolpath-machine-kit.blend` and all five files under `public/assets/machines/`.

The browser loads metadata and immutable hashes from `public/assets/manifests/machine-capability-kit.json`. Automated tests reject missing files, changed hashes, invalid GLB headers, or deviations from the one-mesh/one-material/one-primitive first-generation contract.
