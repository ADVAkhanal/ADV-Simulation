# Runtime coordinate mapping

Machining Kit v1 is authored in Blender with millimeters, +Z world-up, +X machine left/right, and +Y machine front/back. The stock origin is its top center; the cutter origin is its tip. Blender's GLB exporter converts the authored scene to glTF's +Y-up convention. Runtime code reads the exported vertex and node coordinates as delivered and never feeds game values back into the simulation.

The authoritative manual-mill grid maps its horizontal cursor to machine X and vertical cursor to machine Y. The presentation layer moves `machine.spindle.body`, `machine.spindle.tool_anchor`, and `tool.endmill.flat.010` together. Spindle state applies a presentation-only Z offset. Stock opacity follows completion. None of these bindings alter stock cells, collision results, score, acceptance, or progression.

Anchor contract:

- Tool motion: `machine.spindle.tool_anchor`
- Cutter tip: `tool.endmill.flat.010`
- Stock reference: `fixture.vise.stock_anchor`
- Stock geometry: `stock.block.flagship`
- Fixture adjustment: `fixture.vise.jaw_moving`
