/**
 * Competency schema - PRODUCT_SPEC.md §22, §42 deliverable 9.
 *
 * This is the internal model. External frameworks (O*NET codes, the ROLE_LADDER
 * already in ADV-Game's manual-campaign.tsx) map ONTO these ids - they do not
 * replace this list. Per §22: "External frameworks... should map TO the internal
 * competency model rather than becoming the internal data model itself."
 */

export type CompetencyId =
  | "setup-verification"
  | "datum-establishment"
  | "tool-selection"
  | "tooling-inspection"
  | "workholding-verification"
  | "safe-prove-out-reasoning"
  | "abnormal-sound-recognition"
  | "chatter-recognition"
  | "tool-wear-recognition"
  | "coolant-diagnosis"
  | "chip-management-awareness"
  | "metrology-selection"
  | "measurement-technique"
  | "tolerance-interpretation"
  | "quality-disposition"
  | "troubleshooting"
  | "process-monitoring"
  | "maintenance-awareness";

export interface ExternalFrameworkMapping {
  framework: string; // e.g. "O*NET"
  code: string; // e.g. "51-4041.00"
  competencyIds: CompetencyId[];
}

export interface CompetencyEvidence {
  competencyId: CompetencyId;
  demonstratedAt: number; // simTime, seconds
  eventRef: string; // id of the SimulationEvent that constitutes evidence
  outcome: "demonstrated" | "missed" | "critical-error";
  note: string;
}

/**
 * §24: multi-dimensional assessment; a critical error can override aggregate
 * score. `criticalErrorCompetencyIds` being non-empty means the learner cannot
 * pass this scenario regardless of the numeric dimension scores below, even if
 * every other dimension is perfect - the UI/report layer must enforce this, not
 * just display it.
 */
export interface AssessmentDimensions {
  safetyProcessDiscipline: number; // 0..1
  setup: number;
  processControl: number;
  toolConditionRecognition: number;
  troubleshooting: number;
  metrology: number;
  qualityDecision: number;
  efficiency: number;
}

export interface AssessmentResult {
  learnerId: string;
  scenarioId: string;
  scenarioVersion: string;
  simulatorVersion: string;
  rubricVersion: string;
  dateIso: string;
  dimensions: AssessmentDimensions;
  evidence: CompetencyEvidence[];
  criticalErrorCompetencyIds: CompetencyId[];
  interventions: string[]; // instructor intervention event ids
  attemptNumber: number;
  result: "pass" | "fail" | "incomplete";
  replaySessionId: string;
}
