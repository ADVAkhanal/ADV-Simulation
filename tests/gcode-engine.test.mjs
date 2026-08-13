import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildMachiningPlan, gradeMission, parseProgram, rasterize } from "../app/gcode/gcode-engine.ts";

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

test("controller flags a tool crash when a rapid targets Z below the stock", () => {
  const crashed = parseProgram("G21 G90\nM03\nG00 X4 Y4 Z-1\nG01 X10 Y4 F150");
  assert.ok(crashed.diagnostics.some((item) => item.category === "collision"));
  const safe = parseProgram("G21 G90\nM03\nG00 X4 Y4 Z3\nG01 Z-1 F100\nG01 X10 Y4 F150\nG00 Z3");
  assert.ok(!safe.diagnostics.some((item) => item.category === "collision"));
});

test("controller distinguishes clamp strikes and deep dry cutting from ordinary travel", () => {
  const clampStrike = parseProgram("G21 G90\nT1 M06\nM03 M08\nG00 X4 Y4 Z3\nG01 Z-1 F120\nG01 X1 Y4 F120");
  assert.ok(clampStrike.diagnostics.some((item) => item.message.includes("vise clamp")));
  const dryDepth = parseProgram("G21 G90 G17 G94\nT2 M06\nM03\nG00 X4 Y4 Z3\nG01 Z-2.5 F120");
  assert.ok(dryDepth.diagnostics.some((item) => item.message.includes("coolant off")));
  assert.ok(!dryDepth.diagnostics.some((item) => item.category === "unsupported-command"));
});

test("controller keeps the active G54 and tool-length setup state with the program", () => {
  const prepared = parseProgram("G17 G21 G90 G54\nT2 M06\nG43 H02\nM03 M08\nG00 X4 Y4 Z3\nG01 Z-1 F120");
  assert.equal(prepared.errors.length, 0);
  assert.equal(prepared.state.workOffset, "G54");
  assert.equal(prepared.state.tool, 2);
  assert.equal(prepared.state.toolLengthOffset, 2);
  const missingLength = parseProgram("G21 G90\nG43\nG00 X4 Y4 Z3");
  assert.ok(missingLength.diagnostics.some((item) => item.message.includes("needs an H offset")));
});

test("setup planning applies compensation, depth, path reversal, grouping, and multipass", () => {
  const parsed = parseProgram(`G21 G90\nT1 M06\nM03\nG00 X2 Y2 Z3\nG01 Z-1 F120\nG01 X12 Y2\nG01 X12 Y12\nG01 X2 Y12\nG01 X2 Y2\nG00 Z3\nM05`);
  const forward = buildMachiningPlan(parsed, { compensation: "center", finalDepth: -3, path: "as-programmed", passes: 3, reverse: false });
  const reversed = buildMachiningPlan(parsed, { compensation: "left", finalDepth: -3, path: "as-programmed", passes: 3, reverse: true });
  assert.deepEqual(forward.passDepths, [-1, -2, -3]);
  assert.equal(forward.groups.filter((group) => group.kind === "cut").length, 3);
  assert.equal(reversed.direction, "REVERSE");
  assert.equal(reversed.compensationMm, .6);
  assert.ok(reversed.points.length > parsed.points.length);
  assert.equal(Math.min(...reversed.points.filter((point) => point.cut).map((point) => point.z)), -3);
  assert.notDeepEqual(reversed.points.filter((point) => point.cut).map(({ x, y }) => [x, y]), forward.points.filter((point) => point.cut).map(({ x, y }) => [x, y]));
});

test("G//CODE Stage remains explicitly non-machine-ready", async () => {
  const [page, blueprint] = await Promise.all([
    readFile(new URL("../app/gcode/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../GCODE_STAGE.md", import.meta.url), "utf8"),
  ]);
  assert.match(page, /NOT MACHINE-READY/);
  assert.match(page, /SINGLE BLOCK/);
  assert.match(page, /REVERSE PATH/);
  assert.match(page, /OPERATION GROUPS/);
  assert.match(page, /CUTTER COMP/);
  assert.match(page, /FINAL DEPTH/);
  assert.match(page, /MACHINING PATH/);
  assert.match(page, /MULTIPASS/);
  assert.match(blueprint, /fictional creative sandbox/i);
});
