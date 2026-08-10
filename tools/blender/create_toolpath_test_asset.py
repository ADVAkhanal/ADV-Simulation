"""Create the deterministic Blender/MCP smoke-test asset and export it as GLB."""

from pathlib import Path

import bpy


PROJECT_ROOT = Path(globals().get("PROJECT_ROOT", Path(__file__).resolve().parents[2]))
BLEND_PATH = PROJECT_ROOT / "assets-src" / "blender" / "toolpath-mcp-test.blend"
GLB_PATH = PROJECT_ROOT / "public" / "assets" / "test" / "toolpath-mcp-test.glb"

BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
GLB_PATH.parent.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
    for datablock in list(collection):
        collection.remove(datablock)

bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0.0, 0.0, 0.0))
cube = bpy.context.active_object
cube.name = "TOOLPATH_MCP_TEST_CUBE"
cube.data.name = "TOOLPATH_MCP_TEST_CUBE_MESH"
cube["asset_role"] = "pipeline_smoke_test"
cube["units"] = "meters"

material = bpy.data.materials.new("Toolpath_Cyan_Anodized")
material.diffuse_color = (0.012, 0.61, 0.82, 1.0)
material.metallic = 0.82
material.roughness = 0.24
cube.data.materials.append(material)

bevel = cube.modifiers.new("Manufactured edge break", "BEVEL")
bevel.width = 0.055
bevel.segments = 3

bpy.context.view_layer.objects.active = cube
cube.select_set(True)
bpy.ops.object.shade_smooth_by_angle()

scene = bpy.context.scene
scene["pipeline"] = "Project Toolpath Blender MCP"
scene["asset_contract"] = "one cube / one material / origin centered / GLB"
scene.unit_settings.system = "METRIC"
scene.unit_settings.length_unit = "METERS"

bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), check_existing=False)
bpy.ops.export_scene.gltf(
    filepath=str(GLB_PATH),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
)

result = {
    "asset": cube.name,
    "blend_path": str(BLEND_PATH),
    "glb_path": str(GLB_PATH),
    "dimensions": [round(value, 4) for value in cube.dimensions],
    "material": material.name,
    "object_count": len(bpy.data.objects),
}
