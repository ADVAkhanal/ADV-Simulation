import type { Millimeters, Rpm, Kilograms, NewtonMetersPerRadian, Seconds } from "@adv-simulation/units/src/index.ts";

/**
 * PRODUCT_SPEC.md §6: generic machine profiles that differ meaningfully by
 * engineering characteristic, not by cartoon personality. All machine identifiers
 * in this schema must be generic (e.g. "Production VMC 500") per §2 - never a real
 * manufacturer/model name.
 */

export type MachineArchitecture = "3-axis-vmc" | "5-axis-trunnion" | "cnc-lathe" | "wire-edm" | "manual-knee-mill" | "surface-grinder";

export interface AxisTravel {
  axis: "X" | "Y" | "Z" | "A" | "B" | "C";
  travelMm: Millimeters;
}

export interface MachineStiffnessProfile {
  /** Approximate structural stiffness at the tool tip - drives chatter-model coupling per §11. */
  toolTipStiffnessNmPerRad: NewtonMetersPerRadian;
  dampingRatio: number; // 0..1, qualitative per §11 - not a validated modal model
}

export interface MachineThermalProfile {
  /** How much the Z axis grows during spindle warm-up - drives dimensional drift per §19. */
  warmupZGrowthMm: Millimeters;
  warmupDurationSeconds: Seconds;
  ambientSensitivityCPerDegree: number; // dimensional change per degree ambient shift
}

export interface MachineConditionState {
  operatingHours: number;
  /** Free-text engineering notes describing this individual machine's quirks, e.g.
   * "chip conveyor vulnerable to fine aluminum swarf" (§6 example). These are
   * inputs to the grievance engine's trigger conditions, not flavor text. */
  knownCharacteristics: string[];
  maintenanceState: "current" | "due" | "overdue";
}

export interface MachineProfile {
  id: string;
  version: string;
  displayName: string; // generic only - see @adv-simulation/validation's forbidden-brand check
  architecture: MachineArchitecture;
  axisTravels: AxisTravel[];
  massKg: Kilograms;
  stiffness: MachineStiffnessProfile;
  thermal: MachineThermalProfile;
  spindle: {
    maxRpm: Rpm;
    ratedTorqueNm: number;
    warmupRequired: boolean;
  };
  coolant: {
    floodCapable: boolean;
    throughSpindleCapable: boolean;
    airBlastCapable: boolean;
  };
  toolCapacity: number;
  chipEvacuationCapacityRating: "low" | "moderate" | "high";
  condition: MachineConditionState;
}
