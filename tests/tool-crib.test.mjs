import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

const manifestPath = new URL("../public/assets/manifests/toolpath-tool-crib-v1.json", import.meta.url);
const glbPath = new URL("../public/assets/workholding/toolpath-tool-crib-v1.glb", import.meta.url);
const blendPath = new URL("../assets-src/blender/toolpath-tool-crib-v1.blend", import.meta.url);

const expectedSlots = Array.from({ length: 6 }, (_, index) => `toolcrib.slot.${String(index + 1).padStart(2, "0")}`);
const expectedTools = Array.from({ length: 6 }, (_, index) => `tool.endmill.crib.${String(index + 1).padStart(2, "0")}`);
const expectedObjects = ["toolcrib.cabinet.frame", "toolcrib.cabinet.backplate", "toolcrib.placard", ...expectedSlots, ...expectedTools];
const expectedMaterials = ["MAT_CRIB_ACCENT", "MAT_CRIB_BACK", "MAT_CRIB_FRAME", "MAT_SLOT_CUP", "MAT_TOOL_BAND", "MAT_TOOL_STEEL"];

function parseGlb(buffer) {
  assert.equal(buffer.toString("utf8", 0, 4), "glTF");
  assert.equal(buffer.readUInt32LE(4), 2);
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  const jsonLength = buffer.readUInt32LE(12);
  assert.equal(buffer.toString("utf8", 16, 20), "JSON");
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength));
}

test("Tool Crib v1 ships a reproducible, budgeted production asset", async () => {
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
  assert.deepEqual(manifest.slots, expectedSlots);
  assert.deepEqual(manifest.tools, expectedTools);
  assert.deepEqual([...new Set(nodeNames.filter((name) => expectedObjects.includes(name)))].sort(), [...expectedObjects].sort());
  const expectedMeshes = expectedObjects.map((name) => `${name.replaceAll(".", "_")}_mesh`).sort();
  assert.deepEqual(meshNames.sort(), expectedMeshes);
  assert.deepEqual(materialNames, expectedMaterials);
  assert.equal(new Set(nodeNames).size, nodeNames.length, "node names must be unique");
  assert.equal(new Set(meshNames).size, meshNames.length, "mesh names must be unique");
  assert.ok(![...nodeNames, ...meshNames].some((name) => /^(Cube|Cylinder|Empty)(\.\d+)?$/.test(name)), "default Blender names are forbidden");
  assert.equal(triangleCount, manifest.triangleCount);
  assert.ok(triangleCount > 0 && triangleCount <= manifest.releaseBudgets.trianglesMax);
  assert.ok(json.materials.length <= manifest.releaseBudgets.materialsMax);
  assert.ok(glb.length <= manifest.releaseBudgets.glbBytesMax);
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
});
