/**
 * The first real trigger engine for ShopGrievance, per docs/EXTRACTION_PLAN.md's
 * "wire ShopGrievance trigger conditions against the now-real SimulationState"
 * step, now that manual-campaign.tsx's tool-wear extraction gives us a real,
 * live telemetry snapshot to evaluate against (see manual-mill-tool-wear.ts).
 *
 * Deliberately NOT a generic string-expression evaluator over
 * ShopGrievance["triggerConditions"][number]["expression"] - those strings are
 * still prose (see grievances-data.ts's own note: "expression/targetPath/effect
 * strings are deliberately human-readable prose, not typed simulation-state
 * paths yet"). Building a real expression parser/eval engine before there's
 * more than one wireable grievance would be solving a problem we don't have
 * yet. Instead: one named, typed predicate per grievance actually wired,
 * checked against CATALOGED_GRIEVANCES by id so a typo or removed grievance
 * fails a test rather than silently going stale.
 *
 * Most of the 25 cataloged grievances are honestly NOT wireable yet - their own
 * latentStateEffects targetPath already says so ("(future)", "(not yet built)",
 * "not modeled yet": cash-flow, marketplace, staffing, quality-records,
 * batch-state, maintenance-scheduling). Padding this registry with predicates
 * that don't correspond to anything the simulation actually tracks would
 * misrepresent the model, the same over-claiming §38 already warns against
 * elsewhere in this codebase. Wire more as simulation-core's real state grows;
 * don't invent state to make the count go up.
 */

export interface ManualMillTelemetrySnapshot {
  heat: number;
  condition: number;
  load: number;
  finishPenalty: number;
  overcut: number;
  fixtureStrikes: number;
  spindleOn: boolean;
  /** The manual-mill campaign's existing G54 work-offset training scenario (0 = correct, 2.5 = hidden cell shift). */
  workOffsetError: number;
}

export interface GrievanceTrigger {
  grievanceId: string;
  evaluate: (snapshot: ManualMillTelemetrySnapshot) => boolean;
}

/**
 * grievance.setup-carried-over-from-prior-job's real condition is "a setup
 * parameter is wrong and cutting proceeds without it being caught." The manual
 * mill's existing workOffsetError scenario (an operator can confirm G54 zero
 * while a hidden +2.5 cell shift is still active - see manual-campaign.tsx's
 * zeroConfirmed handler) is exactly that failure mode already implemented, so
 * this is a real wiring, not an invented one: the trigger fires once actual
 * cutting begins on top of the unresolved offset.
 */
const MANUAL_MILL_GRIEVANCE_TRIGGERS: GrievanceTrigger[] = [
  {
    grievanceId: "grievance.setup-carried-over-from-prior-job",
    evaluate: (snapshot) => snapshot.workOffsetError > 0 && snapshot.spindleOn,
  },
];

export function evaluateGrievanceTriggers(snapshot: ManualMillTelemetrySnapshot): string[] {
  return MANUAL_MILL_GRIEVANCE_TRIGGERS.filter((trigger) => trigger.evaluate(snapshot)).map((trigger) => trigger.grievanceId);
}

export function wiredGrievanceIds(): string[] {
  return MANUAL_MILL_GRIEVANCE_TRIGGERS.map((trigger) => trigger.grievanceId);
}
