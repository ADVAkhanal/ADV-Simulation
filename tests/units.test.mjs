import test from "node:test";
import assert from "node:assert/strict";
import { rpm, toothPassFrequency, rotationFrequency } from "../packages/units/src/index.ts";

// PRODUCT_SPEC.md §27's explicit named test cases.
test("RPM = 0 -> tooth-pass frequency = 0", () => {
  assert.equal(toothPassFrequency(rpm(0), 4), 0);
});

test("6000 RPM x 4 flutes -> tooth-pass frequency = 400 Hz", () => {
  assert.equal(toothPassFrequency(rpm(6000), 4), 400);
});

test("rotation frequency = RPM / 60", () => {
  assert.equal(rotationFrequency(rpm(1800)), 30);
});
