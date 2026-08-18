import test from "node:test";
import assert from "node:assert/strict";
import { MANUAL_MILL_VALIDATION_RECORDS } from "../packages/validation/src/index.ts";

const VALID_FIDELITIES = new Set(["physically-modeled", "empirically-approximated", "qualitatively-modeled", "pedagogically-simplified"]);
const NON_EMPTY_STRING_FIELDS = ["modelName", "modelVersion", "purpose", "inputRange", "sourceData", "validatedRange", "errorMetric", "outsideRangeBehavior"];
const NON_EMPTY_ARRAY_FIELDS = ["assumptions", "qualitativeExpectations", "knownLimitations"];

test("a validation record exists for every real model built so far", () => {
  const names = MANUAL_MILL_VALIDATION_RECORDS.map((r) => r.modelName);
  for (const expected of ["manual-mill-tool-wear", "manual-mill-chatter", "manual-mill-coolant", "tool-latent-state-decomposition", "procedural-audio-derivation"]) {
    assert.ok(names.includes(expected), `missing a ValidationRecord for ${expected}`);
  }
});

test("every record has a unique modelName", () => {
  const names = MANUAL_MILL_VALIDATION_RECORDS.map((r) => r.modelName);
  assert.equal(new Set(names).size, names.length);
});

test("every record's fidelity is a real ModelFidelity value", () => {
  for (const record of MANUAL_MILL_VALIDATION_RECORDS) {
    assert.ok(VALID_FIDELITIES.has(record.fidelity), `${record.modelName} has an invalid fidelity: ${record.fidelity}`);
  }
});

test("no record overclaims fidelity - none are validated against real data yet, so none may claim physically-modeled or empirically-approximated", () => {
  for (const record of MANUAL_MILL_VALIDATION_RECORDS) {
    assert.ok(
      record.fidelity === "qualitatively-modeled" || record.fidelity === "pedagogically-simplified",
      `${record.modelName} claims ${record.fidelity}, but sourceData/validatedRange/errorMetric are all "None"/"N/A" across every record - a higher fidelity claim would be unsupported`,
    );
  }
});

test("every record's string fields are real prose, not empty placeholders", () => {
  for (const record of MANUAL_MILL_VALIDATION_RECORDS) {
    for (const field of NON_EMPTY_STRING_FIELDS) {
      assert.ok(typeof record[field] === "string" && record[field].trim().length > 0, `${record.modelName}.${field} must be a non-empty string`);
    }
  }
});

test("every record's array fields have at least one real entry", () => {
  for (const record of MANUAL_MILL_VALIDATION_RECORDS) {
    for (const field of NON_EMPTY_ARRAY_FIELDS) {
      assert.ok(Array.isArray(record[field]) && record[field].length > 0, `${record.modelName}.${field} must have at least one entry`);
    }
  }
});

test("every record honestly documents having no validation source data or error metric - none of these models have been fit to measured data", () => {
  for (const record of MANUAL_MILL_VALIDATION_RECORDS) {
    assert.ok(/none|no /i.test(record.sourceData), `${record.modelName}.sourceData should honestly state no external validation data exists`);
    assert.equal(record.errorMetric.includes("N/A"), true, `${record.modelName}.errorMetric should honestly state N/A - no ground truth exists`);
  }
});
