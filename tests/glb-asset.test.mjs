import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

function parseGlb(file) {
  assert.equal(file.toString("ascii", 0, 4), "glTF");
  assert.equal(file.readUInt32LE(4), 2);
  assert.equal(file.readUInt32LE(8), file.length);
  const jsonLength = file.readUInt32LE(12);
  assert.equal(file.toString("ascii", 16, 20), "JSON");
  return JSON.parse(file.toString("utf8", 20, 20 + jsonLength));
}

test("Blender smoke-test GLB is a valid, named, single-mesh production artifact", async () => {
  const file = await readFile(new URL("../public/assets/test/toolpath-mcp-test.glb", import.meta.url));
  const gltf = parseGlb(file);
  assert.equal(gltf.meshes.length, 1);
  assert.equal(gltf.materials.length, 1);
  assert.equal(gltf.nodes.length, 1);
  assert.equal(gltf.nodes[0].name, "TOOLPATH_MCP_TEST_CUBE");
  assert.equal(gltf.meshes[0].primitives.length, 1);
  assert.equal(gltf.asset.version, "2.0");
});

test("machine capability kit ships five privacy-safe, deterministic GLB archetypes", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/assets/manifests/machine-capability-kit.json", import.meta.url), "utf8"));
  assert.equal(manifest.assets.length, 5);
  assert.match(manifest.privacyBoundary, /No manufacturers/);
  assert.deepEqual(new Set(manifest.assets.map((asset) => asset.id)), new Set(["manual-mill", "vertical-3-axis", "trunnion-5-axis", "turning-center", "wire-edm"]));

  for (const asset of manifest.assets) {
    assert.match(asset.file, /^\/assets\/machines\/[a-z0-9-]+\.glb$/);
    assert.equal(asset.trainingFocus.length, 4);
    const file = await readFile(new URL(`../public${asset.file}`, import.meta.url));
    assert.equal(file.length, asset.bytes);
    assert.equal(createHash("sha256").update(file).digest("hex").toUpperCase(), asset.sha256);
    const gltf = parseGlb(file);
    assert.equal(gltf.meshes.length, 1, `${asset.id} mesh count`);
    assert.equal(gltf.materials.length, 1, `${asset.id} material count`);
    assert.equal(gltf.nodes.length, 1, `${asset.id} node count`);
    assert.equal(gltf.meshes[0].primitives.length, 1, `${asset.id} primitive count`);
    assert.equal(gltf.asset.version, "2.0");
  }
});
