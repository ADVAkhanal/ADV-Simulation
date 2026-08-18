import test from "node:test";
import assert from "node:assert/strict";
import { rpm } from "../packages/units/src/index.ts";
import { classifyWearStage, deriveAcousticState } from "../packages/procedural-audio/src/index.ts";

const baseline = { spindleRpm: rpm(7480), fluteCount: 4, spindleOn: true, load: 40, heat: 40, condition: 90, toolBroke: false };

test("classifyWearStage maps the condition scalar onto §10's named checkpoints", () => {
  assert.equal(classifyWearStage(100, false), "healthy");
  assert.equal(classifyWearStage(80, false), "healthy");
  assert.equal(classifyWearStage(79, false), "progressive-wear");
  assert.equal(classifyWearStage(55, false), "progressive-wear");
  assert.equal(classifyWearStage(54, false), "edge-damage");
  assert.equal(classifyWearStage(30, false), "edge-damage");
  assert.equal(classifyWearStage(29, false), "instability");
  assert.equal(classifyWearStage(12, false), "instability");
  assert.equal(classifyWearStage(11, false), "severe-damage");
  assert.equal(classifyWearStage(0, false), "fracture");
  assert.equal(classifyWearStage(50, true), "fracture", "toolBroke forces fracture regardless of the condition value that tick");
});

test("a spinning-but-idle spindle (no load) still has a rotation tone but no cutting noise or chip impacts", () => {
  const state = deriveAcousticState({ ...baseline, load: 0 });
  assert.ok((state.toothPassFrequencyHz) > 0, "spindle is on, so a tooth-pass tone must exist");
  assert.equal(state.broadbandNoiseLevel, 0);
  assert.equal(state.chipImpactRatePerSecond, 0);
});

test("spindle off collapses frequencies and cutting-driven fields to zero", () => {
  const state = deriveAcousticState({ ...baseline, spindleOn: false, load: 40 });
  assert.equal(state.rotationFrequencyHz, 0);
  assert.equal(state.toothPassFrequencyHz, 0);
  assert.deepEqual(state.harmonics, []);
  assert.equal(state.broadbandNoiseLevel, 0);
  assert.equal(state.chipImpactRatePerSecond, 0);
});

test("tooth-pass frequency matches the real units-package formula, not a separate reimplementation", () => {
  const state = deriveAcousticState(baseline);
  // 7480 RPM / 60 * 4 flutes = 498.66..Hz
  assert.ok(Math.abs((state.toothPassFrequencyHz) - (7480 / 60) * 4) < 1e-9);
});

test("higher load raises the fundamental harmonic's amplitude", () => {
  const low = deriveAcousticState({ ...baseline, load: 10 });
  const high = deriveAcousticState({ ...baseline, load: 90 });
  assert.ok(high.harmonics[0].relativeAmplitude > low.harmonics[0].relativeAmplitude);
});

test("degraded condition adds more high-harmonic content without a separate 'danger' input", () => {
  const healthy = deriveAcousticState({ ...baseline, condition: 95 });
  const worn = deriveAcousticState({ ...baseline, condition: 15 });
  assert.ok(worn.harmonics[1].relativeAmplitude > healthy.harmonics[1].relativeAmplitude);
  assert.ok(worn.toothToToothAsymmetry > healthy.toothToToothAsymmetry);
});

test("higher heat raises broadband noise for the same load", () => {
  const cool = deriveAcousticState({ ...baseline, heat: 20 });
  const hot = deriveAcousticState({ ...baseline, heat: 95 });
  assert.ok(hot.broadbandNoiseLevel > cool.broadbandNoiseLevel);
});

test("fractureTransientPending mirrors the tool-wear model's own edge-triggered toolBroke flag, nothing re-derived", () => {
  assert.equal(deriveAcousticState({ ...baseline, toolBroke: false }).fractureTransientPending, false);
  assert.equal(deriveAcousticState({ ...baseline, toolBroke: true }).fractureTransientPending, true);
});

test("resonanceBands stay empty when no vibration input is provided (no chatter model output available)", () => {
  const state = deriveAcousticState({ ...baseline, load: 100, heat: 100, condition: 1 });
  assert.deepEqual(state.resonanceBands, []);
});

test("resonanceBands stay empty when vibration is provided but not chattering", () => {
  const state = deriveAcousticState({ ...baseline, vibration: { amplitudeFraction: 0.1, dominantFrequencyHz: null, chatterActive: false } });
  assert.deepEqual(state.resonanceBands, []);
});

test("resonanceBands populate from the real chatter-model vibration snapshot, not a separate invented one", () => {
  const state = deriveAcousticState({ ...baseline, vibration: { amplitudeFraction: 0.62, dominantFrequencyHz: 748.3, chatterActive: true } });
  assert.deepEqual(state.resonanceBands, [{ frequencyHz: 748.3, relativeAmplitude: 0.62 }]);
});

test("coolantAudioActive defaults to false when no coolant input is provided", () => {
  const state = deriveAcousticState({ ...baseline, load: 100, heat: 100, condition: 1 });
  assert.equal(state.coolantAudioActive, false);
});

test("coolantAudioActive mirrors the real coolant.active input, not a separate invented flag", () => {
  assert.equal(deriveAcousticState({ ...baseline, coolantActive: true }).coolantAudioActive, true);
  assert.equal(deriveAcousticState({ ...baseline, coolantActive: false }).coolantAudioActive, false);
});
