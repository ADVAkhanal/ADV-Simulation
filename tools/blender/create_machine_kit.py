"""Generate privacy-safe CNC capability archetypes for Project Toolpath.

The assets are fictional training silhouettes. They intentionally contain no
manufacturer geometry, controller likeness, model identifiers, or inventory data.
"""

from pathlib import Path
from math import radians
import hashlib
import json

import bpy


PROJECT_ROOT = Path(globals().get("PROJECT_ROOT", Path(__file__).resolve().parents[2]))
BLEND_PATH = PROJECT_ROOT / "assets-src" / "blender" / "toolpath-machine-kit.blend"
GLB_DIR = PROJECT_ROOT / "public" / "assets" / "machines"
MANIFEST_PATH = PROJECT_ROOT / "public" / "assets" / "manifests" / "machine-capability-kit.json"
BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
GLB_DIR.mkdir(parents=True, exist_ok=True)
MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)

ARCHETYPES = [
    {"id": "manual-mill", "name": "FOUNDATION MANUAL MILL", "short_name": "Manual Mill", "process": "Manual milling", "axes": "3 hand-fed axes", "tier": "Foundation", "accent": "#38d7f2", "color": (0.04, 0.58, 0.72, 1.0), "training": ["workholding", "edge finding", "feed feel", "manual coordination"]},
    {"id": "vertical-3-axis", "name": "VERTICAL 3-AXIS CELL", "short_name": "3-Axis VMC", "process": "Vertical machining", "axes": "X / Y / Z", "tier": "Production", "accent": "#55d88f", "color": (0.16, 0.67, 0.42, 1.0), "training": ["datum strategy", "tool offsets", "cycle planning", "inspection loops"]},
    {"id": "trunnion-5-axis", "name": "TRUNNION 5-AXIS CELL", "short_name": "5-Axis Cell", "process": "Simultaneous milling", "axes": "X / Y / Z / A / C", "tier": "Advanced", "accent": "#d8ec3d", "color": (0.73, 0.80, 0.12, 1.0), "training": ["rotary transforms", "reachability", "collision envelopes", "setup reduction"]},
    {"id": "turning-center", "name": "HORIZONTAL TURNING CELL", "short_name": "Turning Cell", "process": "CNC turning", "axes": "X / Z + spindle", "tier": "Production", "accent": "#ff7a38", "color": (0.93, 0.43, 0.13, 1.0), "training": ["work zero", "diameter control", "chuck clearance", "tool sequencing"]},
    {"id": "wire-edm", "name": "WIRE EDM CELL", "short_name": "Wire EDM", "process": "Wire electrical discharge", "axes": "X / Y / U / V", "tier": "Special Process", "accent": "#a977f0", "color": (0.55, 0.34, 0.89, 1.0), "training": ["wire path", "flush strategy", "taper control", "delicate geometry"]},
]


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.curves):
        for datablock in list(collection):
            collection.remove(datablock)


def material_for(spec: dict[str, object]) -> bpy.types.Material:
    material = bpy.data.materials.new("MAT_" + str(spec["id"]).upper().replace("-", "_"))
    material.diffuse_color = spec["color"]
    material.metallic = 0.72
    material.roughness = 0.29
    return material


def finish_part(obj: bpy.types.Object, material: bpy.types.Material, bevel: float = 0.035) -> bpy.types.Object:
    obj.data.materials.append(material)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new("Manufactured edge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)
    return obj


def box(name: str, location: tuple[float, float, float], scale: tuple[float, float, float], material: bpy.types.Material, bevel: float = 0.035) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    return finish_part(obj, material, bevel)


def cylinder(name: str, location: tuple[float, float, float], radius: float, depth: float, material: bpy.types.Material, rotation: tuple[float, float, float] = (0.0, 0.0, 0.0), vertices: int = 20) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    return finish_part(obj, material, 0.018)


def torus(name: str, location: tuple[float, float, float], major: float, minor: float, material: bpy.types.Material, rotation: tuple[float, float, float] = (0.0, 0.0, 0.0)) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=20, minor_segments=8, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    return finish_part(obj, material, 0)


def join_asset(parts: list[bpy.types.Object], spec: dict[str, object]) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    asset = bpy.context.active_object
    asset.name = str(spec["name"])
    asset.data.name = str(spec["id"]).upper().replace("-", "_") + "_MESH"
    asset["asset_id"] = spec["id"]
    asset["capability_archetype"] = True
    asset["process"] = spec["process"]
    asset["axes"] = spec["axes"]
    asset["privacy_boundary"] = "fictional silhouette; no inventory disclosure"
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    asset.location = (0.0, 0.0, -asset.dimensions.z / 2)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    return asset


def manual_mill(spec: dict[str, object], material: bpy.types.Material) -> bpy.types.Object:
    p = []
    p += [box("base", (0, 0, 0.22), (1.4, 0.9, 0.44), material, .08)]
    p += [box("column", (0, .54, 1.55), (.55, .5, 1.45), material, .06)]
    p += [box("knee", (0, .18, 1.0), (.95, .62, .45), material)]
    p += [box("table", (0, -.08, 1.45), (1.55, .48, .18), material, .025)]
    p += [box("ram", (0, .12, 2.72), (.48, .86, .28), material)]
    p += [box("head", (0, -.58, 2.5), (.45, .43, .62), material, .05)]
    p += [cylinder("quill", (0, -.6, 1.92), .16, .64, material)]
    p += [cylinder("spindle", (0, -.6, 1.56), .08, .25, material)]
    p += [torus("x handwheel", (1.7, -.08, 1.42), .24, .035, material, (radians(90), 0, 0))]
    p += [torus("z handwheel", (.94, .18, .95), .2, .03, material, (radians(90), 0, 0))]
    return join_asset(p, spec)


def vertical_cell(spec: dict[str, object], material: bpy.types.Material) -> bpy.types.Object:
    p = []
    p += [box("base", (0, 0, .25), (1.65, 1.25, .5), material, .09)]
    p += [box("back", (0, .95, 1.65), (1.65, .24, 1.55), material, .04)]
    p += [box("left wall", (-1.47, .05, 1.62), (.18, .9, 1.45), material)]
    p += [box("right wall", (1.47, .05, 1.62), (.18, .9, 1.45), material)]
    p += [box("roof", (0, .05, 3.0), (1.65, 1.12, .18), material)]
    p += [box("table", (0, -.12, 1.02), (1.1, .58, .16), material, .02)]
    p += [box("spindle carriage", (0, .7, 2.12), (.52, .4, .72), material)]
    p += [cylinder("spindle", (0, .38, 1.57), .13, .65, material)]
    p += [box("control", (1.88, -.55, 2.05), (.3, .22, .62), material)]
    return join_asset(p, spec)


def trunnion_cell(spec: dict[str, object], material: bpy.types.Material) -> bpy.types.Object:
    p = []
    p += [box("base", (0, 0, .3), (1.72, 1.32, .6), material, .12)]
    p += [box("back", (0, 1.05, 1.75), (1.72, .2, 1.55), material)]
    p += [box("left enclosure", (-1.55, .2, 1.72), (.17, .85, 1.42), material)]
    p += [box("right enclosure", (1.55, .2, 1.72), (.17, .85, 1.42), material)]
    p += [box("bridge", (0, .55, 2.95), (1.65, .55, .22), material)]
    p += [box("head", (0, .4, 2.26), (.42, .4, .58), material)]
    p += [cylinder("spindle", (0, .08, 1.78), .12, .55, material)]
    p += [cylinder("left trunnion", (-.86, -.08, 1.0), .31, .3, material, (0, radians(90), 0))]
    p += [cylinder("right trunnion", (.86, -.08, 1.0), .31, .3, material, (0, radians(90), 0))]
    p += [box("trunnion cradle", (0, -.08, 1.0), (.78, .32, .18), material)]
    p += [cylinder("rotary platter", (0, -.08, 1.22), .58, .18, material)]
    return join_asset(p, spec)


def turning_center(spec: dict[str, object], material: bpy.types.Material) -> bpy.types.Object:
    p = []
    p += [box("base", (0, 0, .32), (1.85, 1.05, .64), material, .1)]
    p += [box("back", (0, .78, 1.62), (1.85, .2, 1.2), material)]
    p += [box("left enclosure", (-1.65, .05, 1.62), (.2, .75, 1.18), material)]
    p += [box("right enclosure", (1.65, .05, 1.62), (.2, .75, 1.18), material)]
    p += [box("roof", (0, .05, 2.72), (1.85, .92, .18), material)]
    p += [box("bed", (0, 0, .88), (1.35, .45, .18), material)]
    p += [box("headstock", (-1.0, .1, 1.35), (.45, .56, .58), material)]
    p += [cylinder("chuck", (-.48, -.02, 1.38), .38, .25, material, (0, radians(90), 0))]
    for y, z in ((-.18, 1.38), (.09, 1.62), (.09, 1.14)):
        p += [box("chuck jaw", (-.3, y, z), (.18, .08, .08), material, .01)]
    p += [cylinder("turret", (.48, -.15, 1.55), .36, .28, material, (radians(90), 0, 0), 12)]
    p += [box("tailstock", (1.05, .08, 1.2), (.34, .45, .42), material)]
    return join_asset(p, spec)


def wire_edm(spec: dict[str, object], material: bpy.types.Material) -> bpy.types.Object:
    p = []
    p += [box("base", (0, 0, .28), (1.55, 1.18, .56), material, .09)]
    p += [box("back column", (0, .88, 1.7), (1.45, .25, 1.4), material)]
    p += [box("tank floor", (0, -.05, .86), (1.25, .78, .12), material, .02)]
    p += [box("tank left", (-1.17, -.05, 1.28), (.08, .78, .42), material, .01)]
    p += [box("tank right", (1.17, -.05, 1.28), (.08, .78, .42), material, .01)]
    p += [box("tank front", (0, -.76, 1.28), (1.25, .08, .42), material, .01)]
    p += [box("work grid", (0, -.02, 1.08), (.78, .52, .08), material, .01)]
    p += [box("upper arm", (0, .38, 2.52), (.42, .58, .28), material)]
    p += [cylinder("upper guide", (0, -.05, 2.06), .1, .58, material)]
    p += [cylinder("lower guide", (0, -.05, 1.22), .09, .24, material)]
    p += [cylinder("wire", (0, -.05, 1.65), .012, .95, material, vertices=12)]
    p += [box("control", (1.72, -.45, 1.95), (.28, .2, .58), material)]
    return join_asset(p, spec)


BUILDERS = [manual_mill, vertical_cell, trunnion_cell, turning_center, wire_edm]

clear_scene()
assets: list[bpy.types.Object] = []
for index, (spec, builder) in enumerate(zip(ARCHETYPES, BUILDERS)):
    material = material_for(spec)
    asset = builder(spec, material)
    bpy.ops.object.select_all(action="DESELECT")
    asset.select_set(True)
    bpy.context.view_layer.objects.active = asset
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_DIR / (str(spec["id"]) + ".glb")),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
    )
    asset.location.x = (index - 2) * 4.2
    assets.append(asset)

bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), check_existing=False)

manifest_assets = []
for spec in ARCHETYPES:
    output = GLB_DIR / (str(spec["id"]) + ".glb")
    payload = output.read_bytes()
    manifest_assets.append({
        "id": spec["id"],
        "name": str(spec["name"]).title(),
        "shortName": spec["short_name"],
        "process": spec["process"],
        "axes": spec["axes"],
        "tier": spec["tier"],
        "accent": spec["accent"],
        "file": "/assets/machines/" + output.name,
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest().upper(),
        "trainingFocus": spec["training"],
    })

MANIFEST_PATH.write_text(json.dumps({
    "schemaVersion": 1,
    "kitId": "privacy-safe-machine-capability-kit",
    "source": "assets-src/blender/toolpath-machine-kit.blend",
    "generator": "Blender 5.2.0 LTS",
    "privacyBoundary": "Fictional capability archetypes only. No manufacturers, models, controllers, quantities, locations, identifiers, network details, or inventory claims.",
    "assets": manifest_assets,
}, indent=2) + "\n", encoding="utf-8")

result = {
    "blend_path": str(BLEND_PATH),
    "assets": [
        {"id": spec["id"], "name": spec["name"], "glb": str(GLB_DIR / (str(spec["id"]) + ".glb"))}
        for spec in ARCHETYPES
    ],
}
