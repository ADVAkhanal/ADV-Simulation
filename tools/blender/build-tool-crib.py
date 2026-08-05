"""Build the Project Toolpath tool crib rack for the G//CODE Stage 3D view.

Modeled after real shop tool-crib management: a wall-mounted rack of
numbered sockets, each holding one cutter with a status band, so a
player can see which tool number (T1..T6) is checked into the
controller at a glance instead of reading a bare integer.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import warnings

import bpy

warnings.filterwarnings("ignore", category=DeprecationWarning)


PROJECT_ROOT = Path(globals().get("PROJECT_ROOT", Path(__file__).resolve().parents[2]))
BLEND_PATH = PROJECT_ROOT / "assets-src" / "blender" / "toolpath-tool-crib-v1.blend"
GLB_PATH = PROJECT_ROOT / "public" / "assets" / "workholding" / "toolpath-tool-crib-v1.glb"
MANIFEST_PATH = PROJECT_ROOT / "public" / "assets" / "manifests" / "toolpath-tool-crib-v1.json"

ASSET_ID = "toolpath.tool-crib.v1"
VERSION = 1
SLOT_COUNT = 6
MAX_TRIANGLES = 40_000
MAX_MATERIALS = 8
MAX_GLB_BYTES = 2 * 1024 * 1024

SLOT_NAMES = [f"toolcrib.slot.{index + 1:02d}" for index in range(SLOT_COUNT)]
TOOL_NAMES = [f"tool.endmill.crib.{index + 1:02d}" for index in range(SLOT_COUNT)]
EXPECTED_NAMES = ["toolcrib.cabinet.frame", "toolcrib.cabinet.backplate", "toolcrib.placard", *SLOT_NAMES, *TOOL_NAMES]

MATERIAL_SPECS = {
    "MAT_CRIB_FRAME": ((0.075, 0.095, 0.105, 1), 0.62, 0.32),
    "MAT_CRIB_BACK": ((0.045, 0.06, 0.068, 1), 0.5, 0.42),
    "MAT_CRIB_ACCENT": ((0.0, 0.682, 0.937, 1), 0.55, 0.2),
    "MAT_SLOT_CUP": ((0.03, 0.035, 0.04, 1), 0.4, 0.5),
    "MAT_TOOL_STEEL": ((0.15, 0.19, 0.21, 1), 0.96, 0.16),
    "MAT_TOOL_BAND": ((1.0, 0.416, 0.0, 1), 0.35, 0.28),
}

# Tool socket radii cycle through the same finisher/rougher/hog-mill family
# used by the manual mill, so both modes read as the same tool catalog.
TOOL_RADII_MM = [4.0, 6.0, 4.0, 6.0, 8.0, 8.0]


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.curves):
        for datablock in list(datablocks):
            datablocks.remove(datablock)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)


def make_material(name: str, base: tuple[float, float, float, float], metallic: float, roughness: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = base
    material.metallic = metallic
    material.roughness = roughness
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = base
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    return material


def tag(obj: bpy.types.Object, asset_type: str, movable: bool, anchor_role: str = "") -> None:
    obj["toolpath.asset_id"] = obj.name
    obj["toolpath.asset_type"] = asset_type
    obj["toolpath.version"] = VERSION
    obj["toolpath.movable"] = movable
    if anchor_role:
        obj["toolpath.anchor_role"] = anchor_role


def apply_and_bevel(obj: bpy.types.Object, material: bpy.types.Material, bevel: float = 1.5) -> bpy.types.Object:
    obj.data.materials.append(material)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Controlled edge break", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)
    return obj


def box(name: str, location: tuple[float, float, float], dimensions: tuple[float, float, float], material: bpy.types.Material, bevel: float = 1.5) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name.replace(".", "_") + "_mesh"
    obj.dimensions = dimensions
    return apply_and_bevel(obj, material, bevel)


def cylinder(name: str, location: tuple[float, float, float], radius: float, depth: float, material: bpy.types.Material, vertices: int = 20, bevel: float = 0.6) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name.replace(".", "_") + "_mesh"
    return apply_and_bevel(obj, material, bevel)


def join_parts(parts: list[bpy.types.Object], name: str) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name.replace(".", "_") + "_mesh"
    return obj


def set_origin(obj: bpy.types.Object, point: tuple[float, float, float]) -> None:
    previous = bpy.context.scene.cursor.location.copy()
    bpy.context.scene.cursor.location = point
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    obj.select_set(False)
    bpy.context.scene.cursor.location = previous


def triangle_count(objects: list[bpy.types.Object]) -> int:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    total = 0
    for obj in objects:
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        total += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()
    return total


def world_bounds(objects: list[bpy.types.Object]) -> dict[str, list[float]]:
    points = [obj.matrix_world @ __import__("mathutils").Vector(corner) for obj in objects if obj.type == "MESH" for corner in obj.bound_box]
    minimum = [min(point[axis] for point in points) for axis in range(3)]
    maximum = [max(point[axis] for point in points) for axis in range(3)]
    return {
        "minMm": [round(value, 3) for value in minimum],
        "maxMm": [round(value, 3) for value in maximum],
        "dimensionsMm": [round(maximum[axis] - minimum[axis], 3) for axis in range(3)],
    }


clear_scene()
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.length_unit = "MILLIMETERS"
scene.unit_settings.scale_length = 0.001
scene["toolpath.asset_id"] = ASSET_ID
scene["toolpath.coordinate_standard"] = "mm; Z up; X left-right; Y front-back"

crib_collection = bpy.data.collections.new("TOOLPATH_TOOL_CRIB_V1")
scene.collection.children.link(crib_collection)
bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[crib_collection.name]

materials = {name: make_material(name, *spec) for name, spec in MATERIAL_SPECS.items()}

SLOT_SPAN = 110.0
FIRST_SLOT_X = -(SLOT_COUNT - 1) * SLOT_SPAN / 2
SLOT_Z = 150.0


# Y layering (camera looks toward +Y from a negative-Y position): the wall
# mass sits farthest back at positive Y, and each part in front of it uses a
# progressively more negative Y so the sockets and tools are never occluded
# by the cabinet body behind them.
WALL_Y = 17.0
SHELF_Y = -5.0
BACKPLATE_Y = -3.0
PLACARD_Y = -10.0
SOCKET_Y = -10.0

frame = join_parts([
    box("frame-outer", (0, WALL_Y, 150), (SLOT_COUNT * SLOT_SPAN + 60, 34, 300), materials["MAT_CRIB_FRAME"], 6),
    box("frame-shelf", (0, SHELF_Y, 40), (SLOT_COUNT * SLOT_SPAN + 40, 20, 18), materials["MAT_CRIB_FRAME"], 3),
], "toolcrib.cabinet.frame")
set_origin(frame, (0, WALL_Y, 0))
tag(frame, "crib_frame", False, "crib_base")

backplate = box("toolcrib.cabinet.backplate", (0, BACKPLATE_Y, 155), (SLOT_COUNT * SLOT_SPAN + 20, 10, 260), materials["MAT_CRIB_BACK"], 2)
set_origin(backplate, (0, BACKPLATE_Y, 155))
tag(backplate, "crib_backplate", False, "crib_backplate")

placard = box("toolcrib.placard", (0, PLACARD_Y, 288), (220, 6, 30), materials["MAT_CRIB_ACCENT"], 1.5)
set_origin(placard, (0, PLACARD_Y, 288))
tag(placard, "crib_placard", False, "crib_id_plate")

slot_objects: list[bpy.types.Object] = []
tool_objects: list[bpy.types.Object] = []
for index in range(SLOT_COUNT):
    x = FIRST_SLOT_X + index * SLOT_SPAN
    radius = TOOL_RADII_MM[index % len(TOOL_RADII_MM)]

    cup_outer = cylinder(f"slot-cup-outer-{index:02d}", (x, SOCKET_Y, SLOT_Z), radius + 9, 20, materials["MAT_SLOT_CUP"], 20, 1.0)
    cup_rim = cylinder(f"slot-cup-rim-{index:02d}", (x, SOCKET_Y - 10, SLOT_Z + 10), radius + 11, 4, materials["MAT_CRIB_ACCENT"], 20, 0.4)
    slot = join_parts([cup_outer, cup_rim], f"toolcrib.slot.{index + 1:02d}")
    set_origin(slot, (x, SOCKET_Y, SLOT_Z))
    tag(slot, "crib_slot", False, f"slot_{index + 1:02d}")
    slot_objects.append(slot)

    shank = cylinder(f"tool-shank-{index:02d}", (x, SOCKET_Y, SLOT_Z + 60), radius * 0.55, 100, materials["MAT_TOOL_STEEL"], 16, 0.5)
    flute = cylinder(f"tool-flute-{index:02d}", (x, SOCKET_Y, SLOT_Z + 14), radius, 24, materials["MAT_TOOL_STEEL"], 16, 0.4)
    band = cylinder(f"tool-band-{index:02d}", (x, SOCKET_Y, SLOT_Z + 96), radius * 0.62, 10, materials["MAT_TOOL_BAND"], 16, 0.2)
    tool = join_parts([shank, flute, band], f"tool.endmill.crib.{index + 1:02d}")
    set_origin(tool, (x, SOCKET_Y, SLOT_Z + 2))
    tag(tool, "crib_tool", True, f"tool_{index + 1:02d}")
    tool_objects.append(tool)

objects = [bpy.data.objects[name] for name in EXPECTED_NAMES]
for obj in objects:
    if obj.type == "MESH":
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        obj.select_set(False)

names = [obj.name for obj in objects]
duplicates = sorted({name for name in names if names.count(name) > 1})
default_names = [name for name in names if name.startswith(("Cube", "Cylinder", "Empty", "Plane"))]
missing = [name for name in EXPECTED_NAMES if name not in bpy.data.objects]
triangles = triangle_count(objects)
material_count = len({slot.material.name for obj in objects if obj.type == "MESH" for slot in obj.material_slots if slot.material})
bounds = world_bounds(objects)

if missing or duplicates or default_names:
    raise RuntimeError(f"Naming validation failed: missing={missing}, duplicates={duplicates}, defaults={default_names}")
if triangles <= 0 or triangles > MAX_TRIANGLES:
    raise RuntimeError(f"Triangle budget failed: {triangles}/{MAX_TRIANGLES}")
if material_count <= 0 or material_count > MAX_MATERIALS:
    raise RuntimeError(f"Material budget failed: {material_count}/{MAX_MATERIALS}")

BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), check_existing=False)

bpy.ops.object.select_all(action="DESELECT")
for obj in objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = frame
bpy.ops.export_scene.gltf(
    filepath=str(GLB_PATH),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_extras=True,
)

payload = GLB_PATH.read_bytes()
if len(payload) > MAX_GLB_BYTES:
    raise RuntimeError(f"GLB size budget failed: {len(payload)}/{MAX_GLB_BYTES}")

manifest = {
    "id": ASSET_ID,
    "version": VERSION,
    "path": "/assets/workholding/toolpath-tool-crib-v1.glb",
    "sourceBlend": "assets-src/blender/toolpath-tool-crib-v1.blend",
    "sourceScript": "tools/blender/build-tool-crib.py",
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "sha256": hashlib.sha256(payload).hexdigest().upper(),
    "coordinateSystem": {
        "units": "millimeters",
        "worldUp": "+Z",
        "machineX": "left/right",
        "machineY": "front/back",
        "machineZ": "vertical",
    },
    "slotCount": SLOT_COUNT,
    "slots": SLOT_NAMES,
    "tools": TOOL_NAMES,
    "objects": EXPECTED_NAMES,
    "materials": sorted(MATERIAL_SPECS),
    "triangleCount": triangles,
    "materialCount": material_count,
    "fileSizeBytes": len(payload),
    "boundingBox": bounds,
    "releaseBudgets": {"trianglesMax": MAX_TRIANGLES, "materialsMax": MAX_MATERIALS, "glbBytesMax": MAX_GLB_BYTES},
}
MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

print(json.dumps({
    "status": "validated",
    "blender": bpy.app.version_string,
    "units": scene.unit_settings.length_unit,
    "collection": crib_collection.name,
    "objectCount": len(objects),
    "triangles": triangles,
    "materials": material_count,
    "glbBytes": len(payload),
    "blend": str(BLEND_PATH),
    "glb": str(GLB_PATH),
    "manifest": str(MANIFEST_PATH),
}, indent=2))

result = manifest
