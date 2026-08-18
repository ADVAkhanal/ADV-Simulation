import { type Hertz, hz } from "@adv-simulation/units/src/index.ts";
import type { VibrationState } from "./state.ts";

/**
 * First real chatter model, per PRODUCT_SPEC.md §11: "coupled machine/tool/
 * workpiece instability depending on spindle speed, tooth-pass excitation,
 * engagement, ... stiffness/damping chain. RPM, engagement, ... and
 * workholding stiffness must each visibly matter - qualitative coherence, not
 * universal predictive accuracy."
 *
 * Populates VibrationState (already defined in state.ts, not a new schema).
 * Deliberately does NOT reach for @adv-simulation/machine-model's
 * MachineStiffnessProfile: nothing in this codebase constructs a real
 * MachineProfile instance yet (the manual-mill game has no machine-model
 * consumer at all), so inventing an absolute N·m/rad stiffness number for a
 * profile nothing else uses would be exactly the "plausible-sounding invented
 * number" anti-pattern this codebase has avoided everywhere else. Instead,
 * this takes toolStiffnessFraction as an already-normalized 0..1 input - the
 * CALLER (the game, which knows its own tool roster) is responsible for that
 * normalization; this package only knows the qualitative relationship, not
 * this game's specific tool radii. Wire a real MachineStiffnessProfile in once
 * one is actually constructed and populated somewhere.
 *
 * Per §11's own "qualitative coherence, not universal predictive accuracy"
 * license, the threshold and the dominant-frequency offset below are tuning
 * knobs, not validated modal-analysis outputs - documented as such, not
 * dressed up as more precise than they are.
 */
export interface ChatterDerivationInput {
  spindleOn: boolean;
  /** 0-100, the real spindle-load telemetry already driving the SPINDLE LOAD meter - the excitation proxy. */
  load: number;
  /**
   * This tool's own realistic peak load ceiling (see manual-mill-tool-wear.ts's
   * estimateMaxLoadForTool), NOT a fixed 0-100 scale. A small-radius tool's real
   * engagement area caps its achievable load well below 100 regardless of feed -
   * normalizing against the fixed scale would make chatter unreachable for
   * exactly the slender tools that should be most prone to it. load is
   * normalized against THIS tool's own ceiling instead.
   */
  loadCeiling: number;
  /** 0..1, caller-normalized structural stiffness of the active tool relative to the stiffest tool in its own roster (1 = stiffest). */
  toolStiffnessFraction: number;
  toothPassFrequencyHz: Hertz;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Below this instability fraction, vibration is present but not classified as
 * chatter - a continuous quantity needs a legible on/off point for UI and
 * audio gating. Calibrated against in-browser verification of this game's
 * manual mill specifically: even sustained, maximum-feed dragging with the
 * least-stiff real tool (T1) only drove load to ~50% of its own estimated
 * ceiling (grid-discretized engagement never reaches the continuous
 * pi*r^2 area estimate) - a threshold above that observed ceiling would make
 * chatter theoretically wired but practically unreachable, exactly the
 * "looks real but is inert" trap this codebase has avoided everywhere else.
 */
const CHATTER_ONSET_THRESHOLD = 0.18;

export function deriveVibrationState(input: ChatterDerivationInput): VibrationState {
  const excitation = input.spindleOn ? clamp01(input.load / Math.max(1, input.loadCeiling)) : 0;
  const stiffnessFraction = clamp01(input.toolStiffnessFraction);
  const amplitudeFraction = clamp01(excitation * (1 - stiffnessFraction));
  const chatterActive = amplitudeFraction > CHATTER_ONSET_THRESHOLD;

  return {
    amplitudeFraction,
    // Classic chatter signature: a spectral peak that sits BETWEEN tooth-pass
    // harmonics rather than on one - modeled as 1.5x the tooth-pass frequency
    // (halfway between the 1st and 2nd harmonic), not a fabricated natural frequency.
    dominantFrequencyHz: chatterActive ? hz((input.toothPassFrequencyHz as number) * 1.5) : null,
    chatterActive,
  };
}
