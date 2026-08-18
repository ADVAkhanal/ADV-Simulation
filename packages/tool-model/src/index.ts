import type { Millimeters } from "@adv-simulation/units/src/index.ts";

/**
 * PRODUCT_SPEC.md §7: tool condition is NOT a single `health = 0..100` scalar.
 * This replaces the single `condition` state currently in ADV-Game's
 * manual-campaign.tsx (see ARCHITECTURE_ASSESSMENT.md) with the decomposed latent
 * states the spec requires. Each field here should have a real, traceable
 * consequence on forces/acoustics/vibration/temperature/finish/breakage
 * susceptibility once simulation-core exists - a field with no consequence
 * anywhere is scope creep, not fidelity.
 */

export type EdgeCondition = "sharp" | "worn" | "chipped" | "fractured";

export interface ToolGeometry {
  fluteCount: number;
  diameterMm: Millimeters;
  cutterMaterial: "hss" | "carbide" | "ceramic" | "cbn" | "pcd";
  coating: "none" | "tin" | "ticn" | "altin" | "diamond";
}

export interface ToolExposureHistory {
  /** Cumulative cutting time by material family - wear does not accumulate identically across materials. */
  exposureSecondsByMaterial: Record<string, number>;
  interruptedCutCount: number;
  thermalCycleCount: number;
  overloadEventCount: number;
}

export interface ToolState {
  id: string;
  geometry: ToolGeometry;

  // Latent physical states - §7's explicit list, not a single scalar.
  flankWearMm: Millimeters;
  edgeCondition: EdgeCondition;
  thermalDamageFraction: number; // 0..1, qualitative per §30's realism-ordering (not a validated thermal model yet)
  builtUpEdgeTendency: number; // 0..1
  coatingDegradationFraction: number; // 0..1
  runoutContributionMm: Millimeters;

  // Configuration affecting how the tool is being used, not the tool itself.
  stickoutMm: Millimeters;
  holderInterface: string; // generic descriptor only, e.g. "HSK-A63" is fine (an interface standard, not a brand)

  exposure: ToolExposureHistory;
  priorDamageNotes: string[];
}

/**
 * Inputs that drive ToolState evolution per §7's explicit list. This is the
 * shape simulation-core's step() will eventually pass to a tool-wear update
 * function - defined here so the tool-model package can be developed and tested
 * independently of simulation-core's existence.
 */
export interface CuttingConditionInput {
  material: string;
  spindleRpm: number;
  feedMmPerMin: number;
  chipLoadMm: number;
  radialEngagementFraction: number; // 0..1 (ae / diameter)
  axialEngagementMm: Millimeters;
  cutDurationSeconds: number;
  coolantActive: boolean;
  rigidityFactor: number; // 0..1, derived from machine + fixture + workholding stiffness chain
  interruptedCut: boolean;
  chipEvacuationOk: boolean;
}

export * from "./derive.ts";
