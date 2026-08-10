"""Render a repeatable visual-QA preview of the flagship machining kit."""

from pathlib import Path
import sys

import bpy
from mathutils import Vector


def point_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
output = Path(args[0]).resolve() if args else Path.cwd() / "build" / "machining-kit-preview.png"
output.parent.mkdir(parents=True, exist_ok=True)

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(output)
scene.render.film_transparent = False
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.012, 0.02, 0.026, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8

bpy.ops.object.camera_add(location=(720, -1620, 700))
camera = bpy.context.object
camera.name = "QA_Camera"
camera.data.lens = 54
camera.data.clip_end = 5000
point_at(camera, (0, 35, 220))
scene.camera = camera

bpy.ops.object.light_add(type="SUN", location=(-300, -600, 900))
sun = bpy.context.object
sun.name = "QA_Sun"
sun.data.energy = 3.2
sun.data.color = (0.58, 0.78, 1.0)
point_at(sun, (0, 20, 170))

for name, location, energy, color, size in [
    ("QA_Key", (-420, -520, 760), 180000, (0.62, 0.88, 1.0), 520),
    ("QA_Work", (250, -170, 370), 95000, (1.0, 0.34, 0.08), 180),
    ("QA_Rim", (520, 320, 610), 130000, (0.08, 0.72, 1.0), 360),
]:
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.color = color
    light.data.shape = "DISK"
    light.data.size = size
    point_at(light, (0, 20, 170))

scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 2.0
bpy.ops.render.render(write_still=True)
print(f"Rendered {output}")
