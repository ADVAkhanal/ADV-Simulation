import type { Hertz } from "@adv-simulation/units/src/index.ts";

/**
 * AcousticState schema - PRODUCT_SPEC.md §8-10, §42 deliverable 7.
 *
 * This is the state DESCRIPTION, not the synthesis engine. Per §44's increment
 * discipline, building the actual oscillator/noise/resonator synthesis (the
 * signature feature) is deferred to its own increment, once simulation-core
 * exists to drive it - synthesizing audio against a schema with nothing feeding
 * it real cutting/tool/machine state would just be guessing at plausible-sounding
 * numbers, which is exactly the "hardcoded danger sound" anti-pattern §12
 * prohibits.
 *
 * The proven starting point for the synthesis implementation itself is
 * `packages/chiptune-synth` in the sibling ADV-WI-Studio repo: Fourier-series
 * PeriodicWave oscillators for harmonic content, and an LFSR-based noise
 * generator for broadband/transient content. Same technique, applied to
 * mechanical stress signatures instead of chiptune waveforms.
 *
 * CRITICAL per §12: nothing in this schema may be set directly from a "this is
 * dangerous" flag. Every field here must be derived from ToolState/MachineProfile/
 * cutting-condition values elsewhere in the simulation. If a future
 * implementation ever writes `if (toolHealth < 10) state.warningTone = true`,
 * that is a spec violation, not a shortcut.
 */

export interface HarmonicComponent {
  frequencyHz: Hertz;
  relativeAmplitude: number; // 0..1
}

export interface AcousticState {
  /** rotation_frequency = RPM / 60, per §9 - always derived, never authored directly. */
  rotationFrequencyHz: Hertz;
  /** tooth_pass_frequency = rotation_frequency * flute_count, per §9. */
  toothPassFrequencyHz: Hertz;

  harmonics: HarmonicComponent[];

  /** Broadband cutting noise level, driven by chip formation / engagement, not a mood slider. */
  broadbandNoiseLevel: number; // 0..1

  /** Non-zero only when the chatter model (§11) indicates a resonance is being excited. */
  resonanceBands: HarmonicComponent[];

  /** Tooth-to-tooth asymmetry from edge damage, per §10's "edge damage" progression stage. */
  toothToToothAsymmetry: number; // 0..1, 0 = perfectly even teeth

  /** Set only by an actual fracture event in tool-model, per §10's "fracture" stage - a discrete transient, not a continuous variable. */
  fractureTransientPending: boolean;

  coolantAudioActive: boolean;
  chipImpactRatePerSecond: number;
}

/**
 * Progression stages named explicitly in §10, kept here as a closed set so a
 * future engine implementation has named checkpoints to target and validate
 * against, rather than an unstructured continuous "wear amount."
 */
export type AcousticWearStage = "healthy" | "progressive-wear" | "edge-damage" | "instability" | "severe-damage" | "fracture";
