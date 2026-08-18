import test from "node:test";
import assert from "node:assert/strict";
import { evaluateGrievanceTriggers, wiredGrievanceIds, CATALOGED_GRIEVANCES } from "../packages/assessment/src/index.ts";

const baseline = { heat: 40, condition: 90, load: 20, finishPenalty: 0, overcut: 0, fixtureStrikes: 0, spindleOn: true, workOffsetError: 0 };

test("wired grievance ids are a real, small, explicitly-scoped subset - not every cataloged grievance", () => {
  const wired = wiredGrievanceIds();
  assert.equal(wired.length, 1, "this increment wires exactly one grievance on purpose - see grievance-evaluator.ts's header note");
  const catalogedIds = new Set(CATALOGED_GRIEVANCES.map((g) => g.id));
  for (const id of wired) assert.ok(catalogedIds.has(id), `wired id ${id} must exist in CATALOGED_GRIEVANCES`);
});

test("setup-carried-over does not fire when the offset is correct, even while cutting", () => {
  const triggered = evaluateGrievanceTriggers({ ...baseline, workOffsetError: 0, spindleOn: true });
  assert.deepEqual(triggered, []);
});

test("setup-carried-over does not fire on an unresolved offset while the spindle is off (not actually cutting yet)", () => {
  const triggered = evaluateGrievanceTriggers({ ...baseline, workOffsetError: 2.5, spindleOn: false });
  assert.deepEqual(triggered, []);
});

test("setup-carried-over fires once cutting actually proceeds on top of the unresolved G54 offset", () => {
  const triggered = evaluateGrievanceTriggers({ ...baseline, workOffsetError: 2.5, spindleOn: true });
  assert.deepEqual(triggered, ["grievance.setup-carried-over-from-prior-job"]);
});
