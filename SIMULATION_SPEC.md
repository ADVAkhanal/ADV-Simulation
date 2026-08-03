# Simulation specification

The browser prototype uses a deterministic 24 x 14 material field. Each material cell is either present or removed. A target mask defines the finished-part keep-zone. Pointer or keyboard motion drives a circular cutter footprint.

- Correct removal: present stock outside the keep-zone becomes removed.
- Overcut: present stock inside the keep-zone becomes removed and adds dimensional damage.
- Load: cutter engagement multiplied by feed override.
- Heat: rises with load and feed; decays when not cutting.
- Tool condition: drops under high load or overheating.
- Chatter: triggered by high feed and engagement; worsens finish.
- Tool break: condition reaches zero; spindle stops, credits are penalized, and a replacement delay occurs.

This is an engineering-inspired gameplay approximation, not operating guidance. Real feeds, speeds, forces, tolerances, workholding, and safety procedures are intentionally simplified.
