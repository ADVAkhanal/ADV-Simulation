import { type Rpm, hz, rotationFrequency, toothPassFrequency } from "@adv-simulation/units/src/index.ts";
import type { AcousticState, AcousticWearStage, HarmonicComponent } from "./index.ts";

/**
 * The actual AcousticState derivation, per PRODUCT_SPEC.md §12: every field
 * below is computed from real machining telemetry (spindle RPM, flute count,
 * load, heat, condition, the tool-wear model's own toolBroke edge) - the same
 * values already driving the visible telemetry meters and the grievance
 * evaluator, not a second, invented "how scary should this sound" input.
 *
 * resonanceBands is now wired to simulation-core's real chatter model
 * (@adv-simulation/simulation-core's deriveVibrationState, see chatter.ts) -
 * this package takes the resulting vibration snapshot as an input and turns
 * an active-chatter flag into a resonance band, it does not compute chatter
 * itself. That vibration snapshot is accepted as a small structurally-typed
 * shape (matching simulation-core's VibrationState field-for-field) rather
 * than an actual import of that type, specifically to avoid a circular
 * package dependency: simulation-core already depends on this package (for
 * SimulationState.acoustic), so this package importing back from
 * simulation-core would create a cycle.
 *
 * coolantAudioActive is now wired to simulation-core's real coolant model
 * (deriveCoolantState, see coolant.ts) the same way resonanceBands is wired to
 * the chatter model - accepted as a plain boolean input (the game's real
 * coolant.active toggle), not re-derived here.
 */
export interface AcousticDerivationInput {
  spindleRpm: Rpm;
  fluteCount: number;
  spindleOn: boolean;
  /** 0-100, from applyManualMillCut's nextState.load. */
  load: number;
  /** 0-100 degC-equivalent scalar, from applyManualMillCut's nextState.heat. */
  heat: number;
  /** 0-100, from applyManualMillCut's nextState.condition. */
  condition: number;
  /** True only on the tick condition crosses from >0 to <=0 - applyManualMillCut's own edge-triggered flag, not re-derived here. */
  toolBroke: boolean;
  /**
   * Optional - matches simulation-core's VibrationState field-for-field (see
   * this file's header note on why it's not literally imported). Omit or pass
   * chatterActive: false while no chatter model output is available yet.
   */
  vibration?: { amplitudeFraction: number; dominantFrequencyHz: number | null; chatterActive: boolean };
  /** simulation-core's real coolant.active - defaults to false (no coolant sound) when omitted. */
  coolantActive?: boolean;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
/** Cooldown's documented heat floor (manual-mill-tool-wear.ts) - the real 0% of this fraction, not an arbitrary rescale. */
const HEAT_FLOOR = 18;

/**
 * Named wear-progression checkpoints from PRODUCT_SPEC.md §10, mapped onto the
 * same 0-100 condition scalar that already drives the TOOL CONDITION meter and
 * the TOOL FAILURE message - one real value, two presentations, not two models.
 */
export function classifyWearStage(condition: number, toolBroke: boolean): AcousticWearStage {
  if (toolBroke || condition <= 0) return "fracture";
  if (condition >= 80) return "healthy";
  if (condition >= 55) return "progressive-wear";
  if (condition >= 30) return "edge-damage";
  if (condition >= 12) return "instability";
  return "severe-damage";
}

export function deriveAcousticState(input: AcousticDerivationInput): AcousticState {
  const rotationFrequencyHz = input.spindleOn ? rotationFrequency(input.spindleRpm) : hz(0);
  const toothPassFrequencyHz = input.spindleOn ? toothPassFrequency(input.spindleRpm, input.fluteCount) : hz(0);

  const wearFraction = clamp01(1 - input.condition / 100);
  const loadFraction = clamp01(input.load / 100);
  const heatFraction = clamp01((input.heat - HEAT_FLOOR) / (100 - HEAT_FLOOR));
  /** Real cutting engagement (load>0 while turning) vs. an idle spinning spindle - an idle spindle still has a rotation tone but no cutting noise or chip impacts. */
  const engagementFraction = input.spindleOn ? loadFraction : 0;

  const fundamentalAmplitude = input.spindleOn ? 0.25 + 0.55 * loadFraction : 0;
  const harmonics: HarmonicComponent[] = input.spindleOn
    ? [
        { frequencyHz: toothPassFrequencyHz, relativeAmplitude: fundamentalAmplitude },
        // Duller edges strike less cleanly, adding higher-harmonic content to the impact - not louder overall, just harder-edged.
        { frequencyHz: hz((toothPassFrequencyHz as number) * 2), relativeAmplitude: fundamentalAmplitude * (0.15 + 0.5 * wearFraction) },
        { frequencyHz: hz((toothPassFrequencyHz as number) * 3), relativeAmplitude: fundamentalAmplitude * (0.05 + 0.35 * wearFraction) },
      ]
    : [];

  const resonanceBands: HarmonicComponent[] =
    input.vibration?.chatterActive && input.vibration.dominantFrequencyHz !== null
      ? [{ frequencyHz: hz(input.vibration.dominantFrequencyHz), relativeAmplitude: clamp01(input.vibration.amplitudeFraction) }]
      : [];

  return {
    rotationFrequencyHz,
    toothPassFrequencyHz,
    harmonics,
    broadbandNoiseLevel: clamp01(engagementFraction * (0.3 + 0.5 * heatFraction)),
    resonanceBands,
    toothToToothAsymmetry: wearFraction,
    fractureTransientPending: input.toolBroke,
    coolantAudioActive: input.coolantActive ?? false,
    chipImpactRatePerSecond: engagementFraction > 0 ? (toothPassFrequencyHz as number) : 0,
  } satisfies AcousticState;
}
