/**
 * Versioned event schema, per PRODUCT_SPEC.md §23. Every assessment-relevant
 * learner action, simulation-state change, consequence, and instructor
 * intervention is recorded as one of these - this is what makes deterministic
 * replay (§27) and the instructor "what happened vs. what the learner could
 * observe" view (§25) possible at all. UI code should never be the only place an
 * action's occurrence is recorded.
 */
export type EventSchemaVersion = 1;

export type SimulationEventKind =
  | "OPERATOR_ACTION"
  | "STATE_CHANGE"
  | "OBSERVATION_AVAILABLE"
  | "GRIEVANCE_TRIGGERED"
  | "GRIEVANCE_PROGRESSED"
  | "CONSEQUENCE_OCCURRED"
  | "COMPETENCY_EVIDENCE"
  | "INSTRUCTOR_INTERVENTION"
  | "ASSESSMENT_CRITICAL_ERROR";

export interface SimulationEvent<TPayload = Record<string, unknown>> {
  schemaVersion: EventSchemaVersion;
  /** Simulation time in seconds since scenario start - NOT wall-clock time, so replay is exact. */
  simTime: number;
  scenarioId: string;
  actor: "learner" | "instructor" | "simulation";
  kind: SimulationEventKind;
  event: string; // e.g. "WORK_OFFSET_CHANGED", "TOOL_FRACTURE", "MEASUREMENT_TAKEN"
  payload: TPayload;
}

/**
 * A replayable session is exactly: provenance + an ordered event log. Nothing
 * about the outcome may depend on anything outside this structure - if it does,
 * replay is not real. See PRODUCT_SPEC.md §27's replay test requirement.
 */
export interface SessionLog {
  sessionId: string;
  learnerId: string;
  events: SimulationEvent[];
}
