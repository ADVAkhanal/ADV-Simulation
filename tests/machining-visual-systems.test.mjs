import test from "node:test";
import assert from "node:assert/strict";
import { toolWearTint } from "../app/machining-visual-systems.ts";

test("toolWearTint shows no wear for a sharp, uncoated-degradation tool", () => {
  const result = toolWearTint("sharp", 0);
  assert.equal(result.wear, 0);
});

test("toolWearTint shows full wear for a fractured tool regardless of coating", () => {
  const result = toolWearTint("fractured", 0);
  assert.equal(result.wear, 1);
});

test("toolWearTint uses whichever of edgeCondition or coatingDegradationFraction indicates MORE wear", () => {
  // sharp (0 wear-fraction) but heavily coating-degraded (0.9) - the tool is not literally sharp anymore in appearance.
  const coatingDominant = toolWearTint("sharp", 0.9);
  assert.equal(coatingDominant.wear, 0.9);
  // chipped (2/3 wear-fraction) but coating barely touched (0.1) - edge condition dominates.
  const edgeDominant = toolWearTint("chipped", 0.1);
  assert.ok(Math.abs(edgeDominant.wear - 2 / 3) < 1e-9);
});

test("toolWearTint's color/roughness/metalness are monotonic with wear - more wear looks duller and rougher, never the reverse", () => {
  const stages = ["sharp", "worn", "chipped", "fractured"];
  const results = stages.map((edge) => toolWearTint(edge, 0));
  for (let i = 1; i < results.length; i += 1) {
    assert.ok(results[i].roughness >= results[i - 1].roughness, `roughness should not decrease from ${stages[i - 1]} to ${stages[i]}`);
    assert.ok(results[i].metalness <= results[i - 1].metalness, `metalness should not increase from ${stages[i - 1]} to ${stages[i]}`);
  }
});

test("toolWearTint never produces a wear value outside 0..1 even at maximum coating degradation", () => {
  const result = toolWearTint("fractured", 1);
  assert.ok(result.wear >= 0 && result.wear <= 1);
});
