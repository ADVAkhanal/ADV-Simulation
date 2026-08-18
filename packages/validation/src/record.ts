/**
 * ValidationRecord schema - PRODUCT_SPEC.md §28, §42 deliverable 10.
 *
 * Every major physical/behavioral model (chatter, tool wear, thermal drift,
 * acoustic synthesis, cutting force proxy, etc.) needs one of these once it has
 * any real implementation. None exist yet because no model has real
 * implementation yet - this schema exists so the FIRST model built has
 * somewhere correct to put its validation record from day one, instead of
 * validation being retrofitted later.
 */

export type ModelFidelity = "physically-modeled" | "empirically-approximated" | "qualitatively-modeled" | "pedagogically-simplified";

export interface ValidationRecord {
  modelName: string;
  modelVersion: string;
  purpose: string;
  assumptions: string[];
  inputRange: string;
  sourceData: string;
  validatedRange: string;
  errorMetric: string;
  qualitativeExpectations: string[];
  knownLimitations: string[];
  outsideRangeBehavior: string;
  fidelity: ModelFidelity;
}

/**
 * §29 pilot validation: the actual question is whether simulator assessment
 * correlates with independently observed instructor judgment - not whether
 * the simulation "feels realistic." This record type exists so that
 * correlation is captured as data, not testimonial.
 */
export interface PilotComparisonRecord {
  learnerId: string;
  scenarioId: string;
  simulatorAssessmentResult: "pass" | "fail" | "incomplete";
  instructorObservedCompetence: "pass" | "fail" | "uncertain";
  agree: boolean;
  instructorNotes: string;
}
