import { type Rpm, hz, rotationFrequency, toothPassFrequency } from "@adv-simulation/units/src/index.ts";
import type { AcousticState, AcousticWearStage, HarmonicComponent } from "./index.ts";

/**
 * The actual AcousticState derivation, per PRODUCT_SPEC.md §12: every field
 * below is computed from real machining telemetry (spindle RPM, flute count,
 * load, heat, condition, the tool-wear model's own toolBroke edge) - the same
 * values already driving the visible telemetry meters and the grievance
 * evaluator, not a second, invented "how scary should this sound" input.
 *
 * Two fields are intentionally left at their honest inert default rather than
 * populated with plausible-looking numbers, because nothing in simulation-core
 * models them yet:
 *  - resonanceBands: the chatter model (§11) doesn't exist yet. Always [].
 *  - coolantAudioActive: no coolant state exists yet. Always false.
 * Wire these for real once those systems land - inventing values now would be
 * exactly the "hardcoded danger sound" anti-pattern §12 prohibits, just moved
 * one field over.
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

  return {
    rotationFrequencyHz,
    toothPassFrequencyHz,
    harmonics,
    broadbandNoiseLevel: clamp01(engagementFraction * (0.3 + 0.5 * heatFraction)),
    resonanceBands: [], // pending §11's chatter model - see header note.
    toothToToothAsymmetry: wearFraction,
    fractureTransientPending: input.toolBroke,
    coolantAudioActive: false, // pending a real coolant model - see header note.
    chipImpactRatePerSecond: engagementFraction > 0 ? (toothPassFrequencyHz as number) : 0,
  } satisfies AcousticState;
}
