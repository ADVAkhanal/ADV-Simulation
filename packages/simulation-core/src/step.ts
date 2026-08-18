import type { SimulationState } from "./state.ts";
import type { SimulationEvent } from "@adv-simulation/telemetry/src/index.ts";
import type { SeededRng } from "@adv-simulation/telemetry/src/index.ts";

/**
 * Deterministic step API - PRODUCT_SPEC.md §4. This signature is the contract;
 * no implementation exists yet (see ARCHITECTURE_ASSESSMENT.md for why the
 * extraction from manual-campaign.tsx is the prerequisite next increment, not
 * this one). Defining the signature now lets machine-model/tool-model/
 * procedural-audio/assessment be developed and type-checked against a stable
 * contract before the physics behind it is implemented.
 *
 * React/UI code must call this function and render its result - it must never
 * compute nextState itself. That is the single most important rule in the whole
 * spec (§3, §44's "verify no arcade tone leaked in" is the sibling check for the
 * OTHER fork; this is this fork's equivalent non-negotiable).
 */
export type OperatorAction =
  | { type: "SET_SPINDLE_RPM"; rpm: number }
  | { type: "SET_FEED"; feedMmPerMin: number }
  | { type: "SET_COOLANT"; active: boolean }
  | { type: "SET_WORK_OFFSET"; axis: "X" | "Y" | "Z"; value: number }
  | { type: "TOOL_CHANGE"; toolId: string }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "MEASURE"; instrumentId: string; targetFeatureId: string };

export interface AssessmentEvidenceDelta {
  competencyId: string;
  outcome: "demonstrated" | "missed" | "critical-error";
  note: string;
}

export interface SimulationStepResult {
  nextState: SimulationState;
  observations: {
    /** What the learner can actually perceive this step - a strict subset of nextState, per §19's ground-truth-vs-operator-knowledge separation. */
    audible: string[];
    visible: string[];
    telemetryReadouts: Record<string, number | string | boolean>;
  };
  emittedEvents: SimulationEvent[];
  assessmentEvidence: AssessmentEvidenceDelta[];
}

/**
 * The contract. `rng` must be the ONLY source of randomness a real implementation
 * uses for anything that could affect assessmentEvidence - see §5 and
 * @adv-simulation/telemetry's SeededRng.
 */
export type StepFn = (state: SimulationState, action: OperatorAction, deltaTimeSeconds: number, rng: SeededRng) => SimulationStepResult;
