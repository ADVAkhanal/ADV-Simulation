import test from "node:test";
import assert from "node:assert/strict";
import { evaluateGrievanceTriggers, wiredGrievanceIds, CATALOGED_GRIEVANCES } from "../packages/assessment/src/index.ts";

const baseline = { heat: 40, condition: 90, load: 20, finishPenalty: 0, overcut: 0, fixtureStrikes: 0, spindleOn: true, workOffsetError: 0, coolantFlowAdequate: true };

test("wired grievance ids are a real, small, explicitly-scoped subset - not every cataloged grievance", () => {
  const wired = wiredGrievanceIds();
  assert.equal(wired.length, 2, "this stage wires exactly two grievances on purpose - see grievance-evaluator.ts's header note");
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

test("thermal-shock-insert-failure does not fire on intermittent coolant if the edge isn't actually hot", () => {
  const triggered = evaluateGrievanceTriggers({ ...baseline, coolantFlowAdequate: false, heat: 30 });
  assert.deepEqual(triggered, []);
});

test("thermal-shock-insert-failure does not fire on a hot edge if coolant contact is steady", () => {
  const triggered = evaluateGrievanceTriggers({ ...baseline, coolantFlowAdequate: true, heat: 90 });
  assert.deepEqual(triggered, []);
});

test("thermal-shock-insert-failure fires when intermittent coolant meets a genuinely hot edge while cutting", () => {
  const triggered = evaluateGrievanceTriggers({ ...baseline, coolantFlowAdequate: false, heat: 90, spindleOn: true });
  assert.deepEqual(triggered, ["grievance.thermal-shock-insert-failure"]);
});

test("both wired grievances can fire together on the same tick - they are independent conditions", () => {
  const triggered = evaluateGrievanceTriggers({ ...baseline, workOffsetError: 2.5, spindleOn: true, coolantFlowAdequate: false, heat: 90 });
  assert.deepEqual(new Set(triggered), new Set(["grievance.setup-carried-over-from-prior-job", "grievance.thermal-shock-insert-failure"]));
});
