"""Render a contact sheet for visual QA of the procedural machine kit."""

from pathlib import Path

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT = PROJECT_ROOT / "tmp" / "machine-kit-preview.png"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1400
scene.render.resolution_y = 560
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(OUTPUT)
scene.render.film_transparent = False
scene.world.color = (0.006, 0.012, 0.016)

bpy.ops.mesh.primitive_plane_add(size=42, location=(0, 0, -3.2))
floor = bpy.context.active_object
floor_mat = bpy.data.materials.new("Preview floor")
floor_mat.diffuse_color = (0.012, 0.023, 0.028, 1)
floor_mat.metallic = .35
floor_mat.roughness = .5
floor.data.materials.append(floor_mat)

bpy.ops.object.camera_add(location=(0, -30, 8.0))
camera = bpy.context.active_object
camera.data.lens = 52
camera.data.sensor_width = 38
target = Vector((0, 0, -.9))
camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = camera

def area(name: str, location: tuple[float, float, float], energy: float, color: tuple[float, float, float], size: float) -> None:
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.active_object
    light.name = name
    light.data.energy = energy
    light.data.color = color
    light.data.shape = "RECTANGLE"
    light.data.size = size
    light.data.size_y = size
    light.rotation_euler = ((target - light.location).to_track_quat("-Z", "Y").to_euler())

area("Cyan key", (-8, -8, 9), 900, (.15, .78, 1.0), 7)
area("Neutral fill", (8, -4, 7), 650, (.8, .9, 1.0), 8)
area("Top rim", (0, 4, 11), 1100, (.55, .72, 1.0), 10)

scene.view_settings.look = "AgX - Medium High Contrast"
bpy.ops.render.render(write_still=True)
print("PREVIEW=" + str(OUTPUT))
