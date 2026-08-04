"""Build Project Toolpath Machining Kit v1 for the flagship manual contract."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import warnings

import bpy
from mathutils import Vector

warnings.filterwarnings("ignore", category=DeprecationWarning)


PROJECT_ROOT = Path(globals().get("PROJECT_ROOT", Path(__file__).resolve().parents[2]))
BLEND_PATH = PROJECT_ROOT / "assets-src" / "blender" / "toolpath-machining-kit-v1.blend"
GLB_PATH = PROJECT_ROOT / "public" / "assets" / "workholding" / "toolpath-machining-kit-v1.glb"
MANIFEST_PATH = PROJECT_ROOT / "public" / "assets" / "manifests" / "toolpath-machining-kit-v1.json"

ASSET_ID = "toolpath.machining-kit.v1"
VERSION = 1
MAX_TRIANGLES = 40_000
MAX_MATERIALS = 8
MAX_GLB_BYTES = 2 * 1024 * 1024

EXPECTED_NAMES = [
    "machine.table",
    "machine.spindle.body",
    "machine.spindle.tool_anchor",
    "fixture.vise.body",
    "fixture.vise.jaw_fixed",
    "fixture.vise.jaw_moving",
    "fixture.vise.stock_anchor",
    "tool.endmill.flat.010",
    "stock.block.flagship",
]

MATERIAL_SPECS = {
    "MAT_MACHINE_DARK": ((0.018, 0.026, 0.031, 1), 0.72, 0.27),
    "MAT_MACHINE_ACCENT": ((0.015, 0.62, 0.82, 1), 0.64, 0.22),
    "MAT_BRUSHED_STEEL": ((0.28, 0.34, 0.37, 1), 0.92, 0.24),
    "MAT_MACHINED_ALUMINUM": ((0.62, 0.69, 0.71, 1), 0.86, 0.19),
    "MAT_TOOL_STEEL": ((0.15, 0.19, 0.21, 1), 0.96, 0.16),
    "MAT_VISE_DARK": ((0.07, 0.10, 0.115, 1), 0.78, 0.31),
}


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


def apply_and_bevel(obj: bpy.types.Object, material: bpy.types.Material, bevel: float = 3.0) -> bpy.types.Object:
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


def box(name: str, location: tuple[float, float, float], dimensions: tuple[float, float, float], material: bpy.types.Material, bevel: float = 3.0) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name.replace(".", "_") + "_mesh"
    obj.dimensions = dimensions
    return apply_and_bevel(obj, material, bevel)


def cylinder(name: str, location: tuple[float, float, float], radius: float, depth: float, material: bpy.types.Material, vertices: int = 24) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name.replace(".", "_") + "_mesh"
    return apply_and_bevel(obj, material, 1.3)


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


def parent_keep_world(child: bpy.types.Object, parent: bpy.types.Object) -> None:
    world = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world


def add_anchor(name: str, location: tuple[float, float, float], parent: bpy.types.Object, role: str) -> bpy.types.Object:
    anchor = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(anchor)
    anchor.empty_display_type = "PLAIN_AXES"
    anchor.empty_display_size = 12
    anchor.location = location
    tag(anchor, "anchor", True, role)
    parent_keep_world(anchor, parent)
    return anchor


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
    points = [obj.matrix_world @ Vector(corner) for obj in objects if obj.type == "MESH" for corner in obj.bound_box]
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

kit_collection = bpy.data.collections.new("TOOLPATH_MACHINING_KIT_V1")
scene.collection.children.link(kit_collection)
bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[kit_collection.name]

materials = {name: make_material(name, *spec) for name, spec in MATERIAL_SPECS.items()}

table = box("machine.table", (0, 0, -35), (680, 460, 70), materials["MAT_MACHINE_DARK"], 10)
accent_rails = [
    box("rail-left", (-260, 0, 5), (22, 390, 18), materials["MAT_MACHINE_ACCENT"], 3),
    box("rail-right", (260, 0, 5), (22, 390, 18), materials["MAT_MACHINE_ACCENT"], 3),
]
table = join_parts([table, *accent_rails], "machine.table")
set_origin(table, (0, 0, 0)); tag(table, "machine_table", False, "table_top_center")

spindle_main = box("spindle-main", (0, 75, 380), (190, 170, 240), materials["MAT_MACHINE_DARK"], 14)
spindle_band = cylinder("spindle-band", (0, 75, 272), 58, 26, materials["MAT_MACHINE_ACCENT"])
spindle_nose = cylinder("spindle-nose", (0, 75, 246), 34, 42, materials["MAT_BRUSHED_STEEL"])
spindle = join_parts([spindle_main, spindle_band, spindle_nose], "machine.spindle.body")
set_origin(spindle, (0, 75, 225)); tag(spindle, "spindle", True, "tool_mount")
tool_anchor = add_anchor("machine.spindle.tool_anchor", (0, 75, 225), spindle, "tool_mount")

vise_body = box("fixture.vise.body", (0, 0, 34), (320, 190, 68), materials["MAT_VISE_DARK"], 8)
vise_key = box("vise-key", (0, 0, 6), (160, 220, 18), materials["MAT_BRUSHED_STEEL"], 3)
vise_body = join_parts([vise_body, vise_key], "fixture.vise.body")
set_origin(vise_body, (0, 0, 0)); tag(vise_body, "fixture_body", False, "fixture_base")

jaw_fixed = box("fixture.vise.jaw_fixed", (0, 68, 88), (300, 34, 108), materials["MAT_BRUSHED_STEEL"], 4)
set_origin(jaw_fixed, (0, 68, 34)); tag(jaw_fixed, "vise_jaw", False, "fixed_jaw")

jaw_moving = box("fixture.vise.jaw_moving", (0, -68, 88), (300, 34, 108), materials["MAT_BRUSHED_STEEL"], 4)
set_origin(jaw_moving, (0, -68, 34)); tag(jaw_moving, "vise_jaw", True, "moving_jaw_slide")

stock = box("stock.block.flagship", (0, 0, 112), (250, 120, 24), materials["MAT_MACHINED_ALUMINUM"], 2)
set_origin(stock, (0, 0, 124)); tag(stock, "stock", True, "stock_top_center")
stock_anchor = add_anchor("fixture.vise.stock_anchor", (0, 0, 124), vise_body, "stock_top_center")
parent_keep_world(stock, stock_anchor)

tool_shank = cylinder("tool-shank", (0, 75, 182.5), 5, 85, materials["MAT_TOOL_STEEL"], 24)
tool_flute = cylinder("tool-flute", (0, 75, 151), 6.35, 22, materials["MAT_TOOL_STEEL"], 16)
tool = join_parts([tool_shank, tool_flute], "tool.endmill.flat.010")
set_origin(tool, (0, 75, 140)); tag(tool, "cutting_tool", True, "cutter_tip")
parent_keep_world(tool, tool_anchor)

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
bpy.context.view_layer.objects.active = table
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
    "path": "/assets/workholding/toolpath-machining-kit-v1.glb",
    "sourceBlend": "assets-src/blender/toolpath-machining-kit-v1.blend",
    "sourceScript": "tools/blender/build-machining-kit.py",
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "sha256": hashlib.sha256(payload).hexdigest().upper(),
    "coordinateSystem": {
        "units": "millimeters",
        "worldUp": "+Z",
        "machineX": "left/right",
        "machineY": "front/back",
        "machineZ": "vertical",
        "stockReference": "top center",
        "toolReference": "cutter tip",
        "spindleReference": "tool anchor",
        "fixtureReference": "stock anchor",
    },
    "anchors": {
        "spindle": "machine.spindle.body",
        "tool": "tool.endmill.flat.010",
        "toolAnchor": "machine.spindle.tool_anchor",
        "stock": "stock.block.flagship",
        "stockAnchor": "fixture.vise.stock_anchor",
        "movingJaw": "fixture.vise.jaw_moving",
    },
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
    "collection": kit_collection.name,
    "objectCount": len(objects),
    "triangles": triangles,
    "materials": material_count,
    "glbBytes": len(payload),
    "blend": str(BLEND_PATH),
    "glb": str(GLB_PATH),
    "manifest": str(MANIFEST_PATH),
}, indent=2))

result = manifest
