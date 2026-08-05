"""Render a repeatable visual-QA preview of the tool crib rack."""

from pathlib import Path
import sys

import bpy
from mathutils import Vector


def point_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
output = Path(args[0]).resolve() if args else Path.cwd() / "build" / "tool-crib-preview.png"
output.parent.mkdir(parents=True, exist_ok=True)

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(output)
scene.render.film_transparent = False
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.01, 0.016, 0.02, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.7

bpy.ops.object.camera_add(location=(430, -1300, 340))
camera = bpy.context.object
camera.name = "QA_Camera"
camera.data.lens = 50
camera.data.clip_end = 4000
point_at(camera, (0, -10, 150))
scene.camera = camera

bpy.ops.object.light_add(type="SUN", location=(-260, -520, 640))
sun = bpy.context.object
sun.name = "QA_Sun"
sun.data.energy = 3.0
sun.data.color = (0.6, 0.8, 1.0)
point_at(sun, (0, 4, 150))

for name, location, energy, color, size in [
    ("QA_Key", (-340, -420, 420), 140000, (0.5, 0.85, 1.0), 420),
    ("QA_Accent", (0, -260, 260), 60000, (0.0, 0.68, 0.94), 200),
    ("QA_Rim", (380, 260, 360), 100000, (1.0, 0.42, 0.0), 280),
]:
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.color = color
    light.data.shape = "DISK"
    light.data.size = size
    point_at(light, (0, 4, 150))

scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 2.0
bpy.ops.render.render(write_still=True)
print(f"Rendered {output}")
