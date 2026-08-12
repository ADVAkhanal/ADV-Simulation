import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("turning cell is a separate X/Z stock-removal game surface", async () => {
  const [page, preview] = await Promise.all([
    readFile(new URL("../app/turn/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/turn/turn-preview.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /G18 G21 G90 G54/);
  assert.match(page, /T0101/);
  assert.match(page, /parseTurning/);
  assert.match(page, /DEEP TURNING WITH COOLANT OFF/);
  assert.match(preview, /CylinderGeometry/);
  assert.match(preview, /radii/);
  assert.match(preview, /stockGroup\.rotation/);
  assert.match(preview, /Interactive 3D turning cell/);
});
