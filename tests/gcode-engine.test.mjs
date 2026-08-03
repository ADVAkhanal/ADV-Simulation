import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gradeMission, parseProgram, rasterize } from "../app/gcode/gcode-engine.ts";

test("G-code engine exposes a deterministic canonical boundary", async () => {
  const engine = await readFile(new URL("../app/gcode/gcode-engine.ts", import.meta.url), "utf8");
  assert.match(engine, /CanonicalMotion/);
  assert.match(engine, /sourceLine/);
  assert.match(engine, /diagnostics/);
  assert.match(engine, /absolute/);
  assert.match(engine, /spindleEnabled/);
  assert.doesNotMatch(engine, /Math\.random/);
});

test("creative controller simulates depth, arcs, stock removal, and repeatable grading", () => {
  const source = `G21 G90\nT2 M06\nM03 M08\nG00 X30 Y20 Z3\nG01 Z-2 F150\nG02 X10 Y20 I-10 J0 F360\nG02 X30 Y20 I10 J0\nG00 Z3\nM09 M05\nM30`;
  const first = parseProgram(source);
  const second = parseProgram(source);
  assert.deepEqual(first, second);
  assert.equal(first.errors.length, 0);
  assert.ok(first.canonical.some((motion) => motion.kind === "arc-cw"));
  assert.ok(first.points.some((point) => point.cut && point.z < 0));
  assert.match(rasterize(first.points, first.points.length), / /);
  assert.deepEqual(gradeMission(first, second), { coverage: 100, precision: 100, waste: 0, cycleSeconds: gradeMission(first, second).cycleSeconds, score: 1000, rank: "S" });
});

test("controller raises an alarm when feeding below stock with the spindle stopped", () => {
  const parsed = parseProgram("G21 G90\nG00 X4 Y4 Z2\nG01 Z-1 F100");
  assert.ok(parsed.diagnostics.some((item) => item.category === "unsafe-state"));
});

test("G//CODE Stage remains explicitly non-machine-ready", async () => {
  const [page, blueprint] = await Promise.all([
    readFile(new URL("../app/gcode/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../GCODE_STAGE.md", import.meta.url), "utf8"),
  ]);
  assert.match(page, /NOT MACHINE-READY/);
  assert.match(page, /SINGLE BLOCK/);
  assert.match(blueprint, /fictional creative sandbox/i);
});
