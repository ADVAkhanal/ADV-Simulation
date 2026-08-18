import type { MachineProfile } from "@adv-simulation/machine-model/src/index.ts";
import type { ToolState } from "@adv-simulation/tool-model/src/index.ts";
import type { AcousticState } from "@adv-simulation/procedural-audio/src/index.ts";
import type { Celsius, Millimeters } from "@adv-simulation/units/src/index.ts";

/**
 * SimulationState - PRODUCT_SPEC.md §42 deliverable 3, the "one truth model" from
 * §3. Every observable (audio, vibration, telemetry readout, surface finish,
 * failure event) must be DERIVED from this state by a step function, never set
 * independently. See ARCHITECTURE_ASSESSMENT.md: this is the type that
 * `manual-campaign.tsx`'s entangled React state needs to be extracted into.
 *
 * Deliberate scope decision: PRODUCT_SPEC.md §4 lists vibration-model,
 * thermal-model, chip-model, coolant-model, and failure-model as separate
 * packages. This first pass keeps them as sub-interfaces inside simulation-core
 * instead of five near-empty sibling packages, because right now each would be a
 * single small interface with no independent consumers - splitting them out
 * before they have real content and real cross-package callers would be the
 * premature-abstraction anti-pattern, not the "smallest coherent architecture"
 * §44 asks for. Extract any of them into their own package the moment a second
 * package needs to import it without also depending on all of simulation-core.
 */

export interface VibrationState {
  /** 0 = perfectly stable cut. Chatter model (§11) is the primary driver once it exists. */
  amplitudeFraction: number;
  dominantFrequencyHz: number | null;
  chatterActive: boolean;
}

export interface ThermalState {
  spindleTemperatureC: Celsius;
  workpieceTemperatureC: Celsius;
  /** Cumulative Z-axis growth from machine + workpiece thermal expansion, per §19's dimensional-drift concern. */
  cumulativeZDriftMm: Millimeters;
  warmupComplete: boolean;
}

export interface ChipState {
  formationQuality: "controlled" | "stringy" | "birdnesting" | "welding";
  evacuationLoadFraction: number; // 0..1, how full the evacuation path is
}

export interface CoolantState {
  active: boolean;
  flowAdequate: boolean;
  concentrationInRange: boolean;
  nozzlePositionOk: boolean;
}

export type FailureMode = "none" | "flank-wear-limit" | "edge-chip" | "fracture" | "workholding-failure" | "power-loss";

export interface FailureState {
  activeMode: FailureMode;
  /** simTime the current failure mode began, or null if activeMode is "none". */
  onsetSimTime: number | null;
}

export interface CuttingState {
  spindleRpm: number;
  feedMmPerMin: number;
  radialEngagementFraction: number;
  axialEngagementMm: Millimeters;
  cuttingForceProxy: number; // unitless 0..1 until a validated force model exists - see validation records
  spindleLoadFraction: number;
}

export interface SimulationState {
  simTime: number;
  machine: MachineProfile;
  tool: ToolState;
  cutting: CuttingState;
  vibration: VibrationState;
  thermal: ThermalState;
  chip: ChipState;
  coolant: CoolantState;
  acoustic: AcousticState;
  failure: FailureState;
}
