/**
 * ShopGrievance schema - PRODUCT_SPEC.md §14, §42 deliverable 8.
 *
 * Populate this from docs/INDUSTRY_GRIEVANCES.md's 25 already-researched, already-
 * sourced entries as the next increment - that conversion is a data-modeling pass,
 * not new research (see ARCHITECTURE_ASSESSMENT.md). Do not invent new grievances
 * before that conversion; the researched backlog already exceeds what a single
 * vertical slice (§43) needs.
 */

export type GrievanceCategory =
  | "cutting" | "tooling" | "workholding" | "chips" | "coolant"
  | "tool-changer-spindle" | "setup" | "programming-control" | "material"
  | "metrology" | "thermal" | "maintenance" | "quality-documentation"
  | "production-business-friction";

export type GrievanceSeverity =
  | "nuisance" | "quality" | "downtime" | "scrap" | "machine-damage" | "safety-critical";

/** §38's evidence classification - never skip straight to "validated." */
export type ValidationStatus = "anecdotal" | "corroborated" | "engineering-supported" | "validated";

export interface SourceReference {
  url: string;
  accessedDate: string; // ISO 8601
  /** A short summary IN OUR OWN WORDS - never paste large copyrighted forum text, per §37/§38. */
  summarizedClaim: string;
}

export interface Condition {
  description: string;
  /** Free-form for now (e.g. "coolantActive === false && cutDurationSeconds > 30") -
   * will tighten to a typed expression once simulation-core's state shape exists. */
  expression: string;
}

export interface StateEffect {
  targetPath: string; // dot-path into simulation state, e.g. "toolState.thermalDamageFraction"
  effect: string; // human-readable until simulation-core defines a typed mutation
}

export interface ProgressionStage {
  name: string;
  description: string;
  observableSymptoms: string[];
}

export interface Consequence {
  description: string;
  severity: GrievanceSeverity;
}

export interface OperatorResponse {
  description: string;
  competencyIds: string[];
}

export interface PreventiveBehavior {
  description: string;
  competencyIds: string[];
}

export interface ShopGrievance {
  id: string;
  title: string;
  category: GrievanceCategory;
  sourceReferences: SourceReference[];

  triggerConditions: Condition[];
  latentStateEffects: StateEffect[];

  observations: {
    audio?: string[];
    visual?: string[];
    telemetry?: string[];
    dimensional?: string[];
    process?: string[];
  };

  progression: ProgressionStage[];
  consequences: Consequence[];

  appropriateResponses: OperatorResponse[];
  inappropriateResponses: OperatorResponse[];
  preventiveBehaviors: PreventiveBehavior[];

  competencies: string[]; // CompetencyId[], see competency.ts
  severity: GrievanceSeverity;

  /** Present only when this grievance has a stochastic trigger - must use @adv-simulation/telemetry's SeededRng, never Math.random(). */
  stochasticModelNote?: string;

  validationStatus: ValidationStatus;
}
