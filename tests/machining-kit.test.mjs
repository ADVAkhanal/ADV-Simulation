import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

const manifestPath = new URL("../public/assets/manifests/toolpath-machining-kit-v1.json", import.meta.url);
const glbPath = new URL("../public/assets/workholding/toolpath-machining-kit-v1.glb", import.meta.url);
const blendPath = new URL("../assets-src/blender/toolpath-machining-kit-v1.blend", import.meta.url);

const expectedObjects = [
  "machine.enclosure.base", "machine.enclosure.column", "machine.enclosure.left",
  "machine.enclosure.right", "machine.enclosure.roof", "machine.waycover.z",
  "machine.worklight", "machine.coolant.manifold", "machine.chiptray",
  "machine.cablechain.x", "machine.guard.doors", "machine.control.pendant",
  "machine.table", "machine.spindle.body", "machine.spindle.toolholder", "machine.spindle.tool_anchor",
  "fixture.vise.body", "fixture.vise.jaw_fixed", "fixture.vise.jaw_moving",
  "fixture.vise.stock_anchor", "tool.endmill.flat.010", "tool.endmill.rougher.020",
  "tool.drill.030", "stock.block.flagship",
];
const expectedMaterials = [
  "MAT_BRUSHED_STEEL", "MAT_MACHINED_ALUMINUM", "MAT_MACHINE_ACCENT",
  "MAT_MACHINE_DARK", "MAT_TOOL_STEEL", "MAT_VISE_DARK",
  "MAT_WARM_WORKLIGHT",
];

function parseGlb(buffer) {
  assert.equal(buffer.toString("utf8", 0, 4), "glTF");
  assert.equal(buffer.readUInt32LE(4), 2);
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  const jsonLength = buffer.readUInt32LE(12);
  assert.equal(buffer.toString("utf8", 16, 20), "JSON");
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength));
}

test("Machining Kit v1 ships a reproducible, budgeted production asset", async () => {
  const [manifest, glb, blend] = await Promise.all([
    readFile(manifestPath, "utf8").then(JSON.parse), readFile(glbPath), stat(blendPath),
  ]);
  const json = parseGlb(glb);
  const nodeNames = json.nodes.map((node) => node.name).filter(Boolean);
  const meshNames = json.meshes.map((mesh) => mesh.name).filter(Boolean);
  const materialNames = json.materials.map((material) => material.name).sort();
  const triangleCount = json.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((meshSum, primitive) => {
    const count = primitive.indices === undefined
      ? json.accessors[primitive.attributes.POSITION].count
      : json.accessors[primitive.indices].count;
    return meshSum + count / 3;
  }, 0), 0);

  assert.ok(blend.size > 0, "source .blend must be non-empty");
  assert.deepEqual(manifest.objects, expectedObjects);
  assert.deepEqual([...new Set(nodeNames.filter((name) => expectedObjects.includes(name)))].sort(), [...expectedObjects].sort());
  const expectedMeshes = expectedObjects.filter((name) => !name.endsWith("anchor")).map((name) => `${name.replaceAll(".", "_")}_mesh`).sort();
  assert.deepEqual(meshNames.sort(), expectedMeshes);
  assert.deepEqual(materialNames, expectedMaterials);
  assert.equal(new Set(nodeNames).size, nodeNames.length, "node names must be unique");
  assert.equal(new Set(meshNames).size, meshNames.length, "mesh names must be unique");
  assert.ok(![...nodeNames, ...meshNames].some((name) => /^(Cube|Cylinder|Empty)(\.\d+)?$/.test(name)), "default Blender names are forbidden");
  assert.equal(triangleCount, manifest.triangleCount);
  assert.ok(triangleCount > 0 && triangleCount <= 40_000);
  assert.ok(json.materials.length <= 8);
  assert.ok(glb.length <= 2 * 1024 * 1024);
  assert.equal(glb.length, manifest.fileSizeBytes);
  assert.equal(createHash("sha256").update(glb).digest("hex").toUpperCase(), manifest.sha256);
  assert.ok(manifest.boundingBox.dimensionsMm.every((value) => value > 0));

  for (const name of expectedObjects) {
    const node = json.nodes.find((item) => item.name === name);
    assert.ok(node, `missing node ${name}`);
    assert.equal(node.extras?.["toolpath.asset_id"], name);
    assert.equal(node.extras?.["toolpath.version"], 1);
    assert.equal(typeof node.extras?.["toolpath.asset_type"], "string");
    assert.equal(typeof node.extras?.["toolpath.movable"], "boolean");
    assert.equal(typeof node.extras?.["toolpath.anchor_role"], "string");
    assert.ok(!node.scale || node.scale.every((value) => value === 1), `${name} has unapplied scale`);
  }
  for (const anchor of Object.values(manifest.anchors)) assert.ok(nodeNames.includes(anchor), `missing anchor ${anchor}`);

  // Every tool the game can select (see MILL_TOOLS in manual-campaign-engine.ts,
  // ids 1/2/3) must have a real, distinct node in the GLB so switching tools
  // in gameplay actually changes what's visibly mounted in the spindle.
  assert.deepEqual(manifest.tools, { "1": "tool.endmill.flat.010", "2": "tool.endmill.rougher.020", "3": "tool.drill.030" });
  const toolNodeNames = Object.values(manifest.tools);
  assert.equal(new Set(toolNodeNames).size, toolNodeNames.length, "tool nodes must be geometrically distinct");
  for (const node of toolNodeNames) assert.ok(nodeNames.includes(node), `missing tool node ${node}`);
});
