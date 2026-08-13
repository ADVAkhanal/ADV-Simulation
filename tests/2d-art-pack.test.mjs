import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

const manifestUrl = new URL("../public/assets/manifests/toolpath-2d-art-pack-v2.json", import.meta.url);
const expectedIds = [
  "contract.drive-plate.v2",
  "contract.orbital-rib.v2",
  "contract.sensor-bracket.v2",
  "environment.night-shift-factory-floor",
  "ui.process-emblem-atlas",
];

test("2D art pack ships optimized runtime images with source masters", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  assert.equal(manifest.id, "toolpath.2d-art-pack.v2");
  assert.deepEqual(manifest.assets.map((asset) => asset.id), expectedIds);
  assert.equal(manifest.runtimeFormat, "WebP");

  let total = 0;
  for (const asset of manifest.assets) {
    const runtimeUrl = new URL(`../public${asset.path}`, import.meta.url);
    const sourceUrl = new URL(`../${asset.source}`, import.meta.url);
    const [runtime, source] = await Promise.all([readFile(runtimeUrl), readFile(sourceUrl)]);
    assert.equal(runtime.toString("ascii", 0, 4), "RIFF", `${asset.id} missing RIFF header`);
    assert.equal(runtime.toString("ascii", 8, 12), "WEBP", `${asset.id} missing WEBP signature`);
    assert.deepEqual([...source.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${asset.id} source is not PNG`);
    assert.equal(runtime.length, asset.bytes);
    assert.equal(createHash("sha256").update(runtime).digest("hex").toUpperCase(), asset.sha256);
    assert.ok(asset.width >= 900 && asset.height >= 600);
    assert.ok(runtime.length < 220_000, `${asset.id} exceeds per-image runtime budget`);
    assert.ok((await stat(sourceUrl)).size > runtime.length, `${asset.id} source master should exceed optimized runtime payload`);
    total += runtime.length;
  }
  assert.equal(total, manifest.totalBytes);
  assert.ok(total < 600_000, "2D runtime pack exceeds 600 KB budget");
});

test("contract selector consumes all three first-article images", async () => {
  const manual = await readFile(new URL("../app/manual-campaign.tsx", import.meta.url), "utf8");
  assert.match(manual, /emergency-drive-plate-v2\.webp/);
  assert.match(manual, /orbital-structural-rib-v2\.webp/);
  assert.match(manual, /sensor-bracket-v2\.webp/);
  assert.match(manual, /<GeometryPreview contract=\{contract\}\/>/);
});

