import test from "node:test";
import assert from "node:assert/strict";
import { hz } from "../packages/units/src/index.ts";
import { deriveVibrationState, estimateMaxLoadForTool } from "../packages/simulation-core/src/index.ts";

const toothPass = hz(498.67);
const baseline = { spindleOn: true, load: 100, loadCeiling: 100, toolStiffnessFraction: 0.2, toothPassFrequencyHz: toothPass };

test("a stiff tool (stiffnessFraction 1) at any load never chatters - matches an infinitely rigid system", () => {
  const state = deriveVibrationState({ ...baseline, toolStiffnessFraction: 1 });
  assert.equal(state.amplitudeFraction, 0);
  assert.equal(state.chatterActive, false);
  assert.equal(state.dominantFrequencyHz, null);
});

test("an idle (spindle off) system never chatters regardless of tool stiffness", () => {
  const state = deriveVibrationState({ ...baseline, spindleOn: false, toolStiffnessFraction: 0 });
  assert.equal(state.amplitudeFraction, 0);
  assert.equal(state.chatterActive, false);
});

test("a slender tool (low stiffnessFraction) near its own load ceiling crosses into real chatter", () => {
  const state = deriveVibrationState({ ...baseline, load: 90, loadCeiling: 100, toolStiffnessFraction: 0.2 });
  assert.ok(state.amplitudeFraction > 0.18, `amplitudeFraction was ${state.amplitudeFraction}`);
  assert.equal(state.chatterActive, true);
  assert.ok(state.dominantFrequencyHz !== null);
});

test("load is normalized against the TOOL'S OWN ceiling, not a fixed 0-100 scale - a small tool near its low ceiling still chatters", () => {
  // A finisher-class tool whose real ceiling is ~19 (per estimateMaxLoadForTool),
  // reading 15/19 = ~79% of its own achievable range, must be treated the same
  // as a 79-out-of-100 reading for a tool with a 100 ceiling - not as "load 15%."
  const smallToolNearItsCeiling = deriveVibrationState({ spindleOn: true, load: 15, loadCeiling: 19, toolStiffnessFraction: 0.2, toothPassFrequencyHz: toothPass });
  const bigToolAtTheSameAbsoluteLoad = deriveVibrationState({ spindleOn: true, load: 15, loadCeiling: 100, toolStiffnessFraction: 0.2, toothPassFrequencyHz: toothPass });
  assert.ok(smallToolNearItsCeiling.amplitudeFraction > bigToolAtTheSameAbsoluteLoad.amplitudeFraction);
  assert.equal(smallToolNearItsCeiling.chatterActive, true);
  assert.equal(bigToolAtTheSameAbsoluteLoad.chatterActive, false);
});

test("dominant chatter frequency sits between the 1st and 2nd tooth-pass harmonics, not on either", () => {
  const state = deriveVibrationState({ ...baseline, load: 90 });
  assert.ok(state.dominantFrequencyHz > toothPass && state.dominantFrequencyHz < toothPass * 2);
});

test("higher load (relative to ceiling) raises instability, holding tool stiffness fixed", () => {
  const low = deriveVibrationState({ ...baseline, load: 20, toolStiffnessFraction: 0.3 });
  const high = deriveVibrationState({ ...baseline, load: 90, toolStiffnessFraction: 0.3 });
  assert.ok(high.amplitudeFraction > low.amplitudeFraction);
});

test("a less stiff tool raises instability, holding load fixed", () => {
  const stiff = deriveVibrationState({ ...baseline, load: 70, toolStiffnessFraction: 0.9 });
  const slender = deriveVibrationState({ ...baseline, load: 70, toolStiffnessFraction: 0.3 });
  assert.ok(slender.amplitudeFraction > stiff.amplitudeFraction);
});

test("estimateMaxLoadForTool reuses applyManualMillCut's own constants (7.6, /55) against the tool's full circular footprint", () => {
  // T1 finisher: radius .78, toolLoad .62, at 115% feed override.
  const ceiling = estimateMaxLoadForTool(0.78, 0.62, 115);
  const maxEngagement = Math.PI * 0.78 * 0.78;
  const expected = Math.round(maxEngagement * 7.6 * 0.62 * (115 / 55));
  assert.equal(ceiling, expected);
  assert.ok(ceiling > 0 && ceiling <= 100);
});

test("estimateMaxLoadForTool never returns 0 (would divide by zero when used as a normalization ceiling)", () => {
  assert.ok(estimateMaxLoadForTool(0.01, 0.01, 25) >= 1);
});
