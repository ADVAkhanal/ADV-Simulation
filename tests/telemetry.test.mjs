import test from "node:test";
import assert from "node:assert/strict";
import { createSeededRng } from "../packages/telemetry/src/index.ts";

// PRODUCT_SPEC.md §27: "same seed + same configuration + same actions -> same
// assessed outcome" - this is the foundational determinism guarantee everything
// else in the spec (replay, reproducible assessment) depends on.
test("same seed produces the same sequence", () => {
  const a = createSeededRng(42);
  const b = createSeededRng(42);
  const seqA = [a.next(), a.next(), a.next()];
  const seqB = [b.next(), b.next(), b.next()];
  assert.deepEqual(seqA, seqB);
});

test("different seeds produce different sequences", () => {
  const a = createSeededRng(42);
  const c = createSeededRng(43);
  assert.notEqual(a.next(), c.next());
});

test("derive() is deterministic per label, independent of draw order", () => {
  const parent1 = createSeededRng(7);
  const parent2 = createSeededRng(7);
  const child1 = parent1.derive("tool-wear-noise");
  const child2 = parent2.derive("tool-wear-noise");
  assert.equal(child1.next(), child2.next());
});

test("derive() with different labels produces independent streams", () => {
  const parent = createSeededRng(7);
  const childA = parent.derive("tool-wear-noise");
  const childB = parent.derive("acoustic-jitter");
  assert.notEqual(childA.next(), childB.next());
});

test("nextInRange stays within bounds across many draws", () => {
  const rng = createSeededRng(99);
  for (let i = 0; i < 1000; i++) {
    const value = rng.nextInRange(-5, 5);
    assert.ok(value >= -5 && value < 5, `value ${value} out of range`);
  }
});
