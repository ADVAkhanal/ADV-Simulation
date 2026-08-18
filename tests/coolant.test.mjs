import test from "node:test";
import assert from "node:assert/strict";
import { deriveCoolantState } from "../packages/simulation-core/src/index.ts";

test("steady flood (active, no recent toggles) is flowAdequate", () => {
  const state = deriveCoolantState({ active: true, recentToggleCount: 0 });
  assert.equal(state.active, true);
  assert.equal(state.flowAdequate, true);
});

test("steady dry (inactive, no recent toggles) is ALSO flowAdequate - the risk is intermittency, not the on/off choice", () => {
  const state = deriveCoolantState({ active: false, recentToggleCount: 0 });
  assert.equal(state.active, false);
  assert.equal(state.flowAdequate, true);
});

test("frequent on/off toggling (dabbing) is not flowAdequate, regardless of current active value", () => {
  const whileOn = deriveCoolantState({ active: true, recentToggleCount: 3 });
  const whileOff = deriveCoolantState({ active: false, recentToggleCount: 3 });
  assert.equal(whileOn.flowAdequate, false);
  assert.equal(whileOff.flowAdequate, false);
});

test("a single toggle (e.g. one deliberate flood->dry switch) is not yet classified as dabbing", () => {
  const state = deriveCoolantState({ active: false, recentToggleCount: 1 });
  assert.equal(state.flowAdequate, true);
});

test("concentrationInRange and nozzlePositionOk stay at their honest inert default - no such model exists yet", () => {
  const state = deriveCoolantState({ active: true, recentToggleCount: 5 });
  assert.equal(state.concentrationInRange, true);
  assert.equal(state.nozzlePositionOk, true);
});
