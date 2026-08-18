import test from "node:test";
import assert from "node:assert/strict";
import {
  applyManualMillCut,
  applyManualMillCooldown,
  restoreManualMillTool,
  swapManualMillTool,
} from "../packages/simulation-core/src/index.ts";

// Regression safety net for docs/EXTRACTION_PLAN.md's extraction. Expected
// values below are hand-computed from the ORIGINAL inline formula in
// manual-campaign.tsx's cutAt() (captured before any refactor), independent of
// this ported implementation - this is what makes the test meaningful as a
// regression check rather than the port grading its own homework.
const approxEqual = (a, b, tolerance = 1e-9) => Math.abs(a - b) <= tolerance;

test("ordinary cut: matches hand-computed values from the original formula", () => {
  const state = { heat: 50, condition: 80, load: 20, finishPenalty: 5 };
  const inputs = { engagement: 4, overcut: 0, fixtureStrikes: 0, correct: 4, toolLoad: 1, toolWear: 1, toolFinish: 1, feed: 55, operationIsFinish: false };
  const result = applyManualMillCut(state, inputs);

  // nextLoad = clamp(round(4 * 7.6 * 1 * (55/55)), 0, 100) = 30
  assert.equal(result.nextState.load, 30);
  // heat = clamp(50 + 4*0.45*1*(55/50), 18, 100) = clamp(50 + 1.98, ...) = 51.98
  assert.ok(approxEqual(result.nextState.heat, 51.98), `heat was ${result.nextState.heat}`);
  // wear = 4*0.055*1*(1+0) = 0.22 -> condition = 80 - 0.22 = 79.78
  assert.ok(approxEqual(result.nextState.condition, 79.78), `condition was ${result.nextState.condition}`);
  assert.equal(result.toolBroke, false);
  // not a finish op: finishPenalty = 5 + max(0, 30-82)*0.018*1 + 0*0.25 = 5
  assert.ok(approxEqual(result.nextState.finishPenalty, 5), `finishPenalty was ${result.nextState.finishPenalty}`);
});

test("fracture cut: condition crosses zero, toolBroke fires exactly on the crossing", () => {
  const state = { heat: 50, condition: 1, load: 10, finishPenalty: 0 };
  const inputs = { engagement: 10, overcut: 2, fixtureStrikes: 1, correct: 0, toolLoad: 1, toolWear: 1, toolFinish: 1, feed: 80, operationIsFinish: false };
  const result = applyManualMillCut(state, inputs);

  // nextLoad = clamp(round(10*7.6*1*(80/55)), 0, 100) = clamp(round(110.545...), 0, 100) = 100
  assert.equal(result.nextState.load, 100);
  // heat = clamp(50 + 10*0.45*1*(80/50), ...) = clamp(50 + 7.2, ...) = 57.2
  assert.ok(approxEqual(result.nextState.heat, 57.2), `heat was ${result.nextState.heat}`);
  // wear = 10*0.055*1*(1+10/35) + 1*14 = 0.55*1.285714... + 14 = 14.707142857...
  // condition = clamp(1 - 14.7071..., 0, 100) = 0
  assert.equal(result.nextState.condition, 0);
  assert.equal(result.toolBroke, true, "condition crossed from >0 to <=0, toolBroke must fire");
  // finishPenalty = 0 + max(0, 100-82)*0.018*1 + 2*0.25 = 0.324 + 0.5 = 0.824
  assert.ok(approxEqual(result.nextState.finishPenalty, 0.824), `finishPenalty was ${result.nextState.finishPenalty}`);
});

test("toolBroke does not re-fire once already at zero", () => {
  const state = { heat: 50, condition: 0, load: 0, finishPenalty: 0 };
  const inputs = { engagement: 5, overcut: 0, fixtureStrikes: 0, correct: 0, toolLoad: 1, toolWear: 1, toolFinish: 1, feed: 55, operationIsFinish: false };
  const result = applyManualMillCut(state, inputs);
  assert.equal(result.toolBroke, false, "condition was already <=0 before this cut, must not re-trigger breakage");
});

test("finish operation reduces finishPenalty instead of accumulating it", () => {
  const state = { heat: 30, condition: 100, load: 0, finishPenalty: 10 };
  const inputs = { engagement: 3, overcut: 0, fixtureStrikes: 0, correct: 3, toolLoad: 1, toolWear: 1, toolFinish: 1, feed: 55, operationIsFinish: true };
  const result = applyManualMillCut(state, inputs);
  // finishPenalty = max(0, 10 - 3*0.075) = max(0, 9.775) = 9.775
  assert.ok(approxEqual(result.nextState.finishPenalty, 9.775), `finishPenalty was ${result.nextState.finishPenalty}`);
});

test("cooldown: spindle running sheds heat slower than spindle idle", () => {
  const running = applyManualMillCooldown({ heat: 50, condition: 100, load: 20, finishPenalty: 0 }, true);
  const idle = applyManualMillCooldown({ heat: 50, condition: 100, load: 20, finishPenalty: 0 }, false);
  assert.ok(approxEqual(running.heat, 49.65), `running heat was ${running.heat}`);
  assert.ok(approxEqual(idle.heat, 47.6), `idle heat was ${idle.heat}`);
  assert.equal(running.load, 16);
  assert.equal(idle.load, 16);
});

test("cooldown never drops heat below its floor of 18", () => {
  const result = applyManualMillCooldown({ heat: 19, condition: 100, load: 0, finishPenalty: 0 }, false);
  assert.equal(result.heat, 18);
});

test("restoreManualMillTool and swapManualMillTool reset condition identically but heat differently (preserved asymmetry, not a bug)", () => {
  assert.deepEqual(restoreManualMillTool(), { heat: 25, condition: 100 });
  assert.deepEqual(swapManualMillTool(), { heat: 20, condition: 100 });
});
