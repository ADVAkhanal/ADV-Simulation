import test from "node:test";
import assert from "node:assert/strict";
import { classifyEdgeCondition, deriveToolLatentState } from "../packages/tool-model/src/index.ts";

test("classifyEdgeCondition maps the condition scalar onto EdgeCondition's four named states", () => {
  assert.equal(classifyEdgeCondition(100), "sharp");
  assert.equal(classifyEdgeCondition(80), "sharp");
  assert.equal(classifyEdgeCondition(79), "worn");
  assert.equal(classifyEdgeCondition(40), "worn");
  assert.equal(classifyEdgeCondition(39), "chipped");
  assert.equal(classifyEdgeCondition(1), "chipped");
  assert.equal(classifyEdgeCondition(0), "fractured");
  assert.equal(classifyEdgeCondition(-5), "fractured");
});

test("flankWearMm is 0 at full condition and reaches the real VBmax limit (0.3mm) at zero condition", () => {
  const full = deriveToolLatentState({ condition: 100, heat: 40, previousThermalDamageFraction: 0 });
  const zero = deriveToolLatentState({ condition: 0, heat: 40, previousThermalDamageFraction: 0 });
  assert.equal(full.flankWearMm, 0);
  assert.ok(Math.abs(zero.flankWearMm - 0.3) < 1e-9, `flankWearMm was ${zero.flankWearMm}`);
});

test("flankWearMm is monotonic with wear (lower condition => more flank wear)", () => {
  const light = deriveToolLatentState({ condition: 90, heat: 40, previousThermalDamageFraction: 0 });
  const heavy = deriveToolLatentState({ condition: 20, heat: 40, previousThermalDamageFraction: 0 });
  assert.ok(heavy.flankWearMm > light.flankWearMm);
});

test("thermalDamageFraction does not accumulate at all below the hot-heat threshold", () => {
  const result = deriveToolLatentState({ condition: 90, heat: 69, previousThermalDamageFraction: 0.1 });
  assert.equal(result.thermalDamageFraction, 0.1, "heat below threshold must not add any damage this tick");
});

test("thermalDamageFraction accumulates (rises) once heat is genuinely above the threshold", () => {
  const result = deriveToolLatentState({ condition: 90, heat: 100, previousThermalDamageFraction: 0.1 });
  assert.ok(result.thermalDamageFraction > 0.1, `thermalDamageFraction was ${result.thermalDamageFraction}`);
});

test("thermalDamageFraction is genuinely cumulative - carries the previous tick's value forward, never resets on its own", () => {
  let damage = 0;
  for (let i = 0; i < 50; i++) {
    damage = deriveToolLatentState({ condition: 90, heat: 100, previousThermalDamageFraction: damage }).thermalDamageFraction;
  }
  assert.ok(damage > 0.1, "50 ticks pinned at max heat must have accumulated meaningfully more than a single tick");
});

test("thermalDamageFraction never exceeds 1", () => {
  const result = deriveToolLatentState({ condition: 90, heat: 100, previousThermalDamageFraction: 0.999 });
  assert.ok(result.thermalDamageFraction <= 1);
});

test("condition remains the single source of truth - flankWearMm/edgeCondition never diverge from it independently", () => {
  const a = deriveToolLatentState({ condition: 50, heat: 20, previousThermalDamageFraction: 0 });
  const b = deriveToolLatentState({ condition: 50, heat: 90, previousThermalDamageFraction: 0 });
  assert.equal(a.flankWearMm, b.flankWearMm, "flankWearMm depends only on condition, not heat");
  assert.equal(a.edgeCondition, b.edgeCondition, "edgeCondition depends only on condition, not heat");
});
