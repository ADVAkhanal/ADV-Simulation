import type { AcousticState } from "./index.ts";

/**
 * The actual synthesis engine - takes deriveAcousticState()'s output and turns
 * it into sound on a real AudioContext. Not unit-testable (no Web Audio in
 * Node); all business logic (what the numbers mean) lives in the tested
 * derive.ts, this file is deliberately mechanical: build oscillators/noise
 * nodes, keep them alive, and smoothly retarget their params every update()
 * rather than tearing down and recreating nodes every tick (which would click
 * and would make "continuously live" telemetry sound like a sequence of
 * discrete blips - exactly what this replaces).
 *
 * Technique carried over from the sibling ADV-WI-Studio repo's
 * packages/chiptune-synth: an LFSR-generated noise buffer for broadband/gritty
 * content (see lfsrNoise.ts), applied here to cutting noise instead of
 * chiptune percussion. Harmonics are plain sine oscillators, one per
 * HarmonicComponent, rather than a single Fourier-series PeriodicWave -
 * AcousticState's harmonics are already an explicit, usually-just-2-or-3-entry
 * frequency/amplitude list (not a fixed-waveform timbre to reconstruct), so
 * summing a few real oscillators is the more literal, honest match.
 *
 * Deliberately NOT modulating noise "color"/rate from state yet (only its
 * gain) - see derive.ts's own honesty notes on resonanceBands/coolantAudioActive
 * for the same pattern: ship what's real now, don't fake refinement.
 */

const MAX_HARMONICS = 3;
const SMOOTHING_SECONDS = 0.08;
/** Fixed LFSR period for a mid-grit broadband texture - only level is state-driven this increment, not color. */
const NOISE_PERIOD_SAMPLES_AT_44K = 40;

function generateLfsrNoiseBuffer(audioContext: BaseAudioContext, durationSeconds: number, periodSamples: number): AudioBuffer {
  const sampleRate = audioContext.sampleRate;
  const totalSamples = Math.max(1, Math.round(durationSeconds * sampleRate));
  const buffer = audioContext.createBuffer(1, totalSamples, sampleRate);
  const data = buffer.getChannelData(0);

  let register = 1;
  let sampleCounter = 0;
  let currentLevel = register & 1 ? 1 : -1;

  for (let i = 0; i < totalSamples; i++) {
    if (sampleCounter >= periodSamples) {
      const feedback = (register & 1) ^ ((register >> 1) & 1);
      register = (register >> 1) | (feedback << 14);
      currentLevel = register & 1 ? 1 : -1;
      sampleCounter = 0;
    }
    data[i] = currentLevel;
    sampleCounter++;
  }
  return buffer;
}

export interface AcousticEngine {
  update: (state: AcousticState) => void;
  /** A discrete, non-looping event - call once per real fracture, not driven by a continuous state field. */
  triggerFractureTransient: () => void;
  setEnabled: (on: boolean) => void;
  dispose: () => void;
}

export function createAcousticEngine(): AcousticEngine {
  let ctx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let noiseGain: GainNode | null = null;
  let harmonicOscillators: OscillatorNode[] = [];
  let harmonicGains: GainNode[] = [];

  function ensureContext(): AudioContext | null {
    if (ctx) return ctx;
    const AudioCtor = typeof window === "undefined" ? undefined : (window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AudioCtor) return null;
    try {
      ctx = new AudioCtor();
      masterGain = ctx.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(ctx.destination);

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = generateLfsrNoiseBuffer(ctx, 2, NOISE_PERIOD_SAMPLES_AT_44K);
      noiseSource.loop = true;
      noiseGain = ctx.createGain();
      noiseGain.gain.value = 0;
      noiseSource.connect(noiseGain).connect(masterGain);
      noiseSource.start();

      for (let i = 0; i < MAX_HARMONICS; i++) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = 440;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        osc.connect(gain).connect(masterGain);
        osc.start();
        harmonicOscillators.push(osc);
        harmonicGains.push(gain);
      }
    } catch {
      ctx = null; // audio is optional and must never interrupt play
    }
    return ctx;
  }

  function update(state: AcousticState) {
    const audio = ensureContext();
    if (!audio || !masterGain || !noiseGain) return;
    if (audio.state === "suspended") void audio.resume();
    const now = audio.currentTime;

    for (let i = 0; i < MAX_HARMONICS; i++) {
      const component = state.harmonics[i];
      const osc = harmonicOscillators[i], gain = harmonicGains[i];
      if (component && (component.frequencyHz as number) > 0) {
        osc.frequency.setTargetAtTime(component.frequencyHz as number, now, SMOOTHING_SECONDS);
        gain.gain.setTargetAtTime(component.relativeAmplitude * 0.12, now, SMOOTHING_SECONDS);
      } else {
        gain.gain.setTargetAtTime(0, now, SMOOTHING_SECONDS);
      }
    }

    noiseGain.gain.setTargetAtTime(state.broadbandNoiseLevel * 0.05, now, SMOOTHING_SECONDS);
  }

  function triggerFractureTransient() {
    const audio = ensureContext();
    if (!audio || !masterGain) return;
    const start = audio.currentTime;
    const duration = 0.35;

    const burst = audio.createBufferSource();
    burst.buffer = generateLfsrNoiseBuffer(audio, duration, 6); // short period = harsh, metallic
    const burstGain = audio.createGain();
    burstGain.gain.setValueAtTime(0.35, start);
    burstGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    burst.connect(burstGain).connect(masterGain);
    burst.start(start);
    burst.stop(start + duration + 0.01);

    const drop = audio.createOscillator();
    drop.type = "triangle";
    drop.frequency.setValueAtTime(900, start);
    drop.frequency.exponentialRampToValueAtTime(60, start + duration);
    const dropGain = audio.createGain();
    dropGain.gain.setValueAtTime(0.2, start);
    dropGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    drop.connect(dropGain).connect(masterGain);
    drop.start(start);
    drop.stop(start + duration + 0.01);
  }

  function setEnabled(on: boolean) {
    if (!masterGain || !ctx) return;
    masterGain.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
  }

  function dispose() {
    harmonicOscillators.forEach((osc) => { try { osc.stop(); } catch { /* already stopped */ } });
    harmonicOscillators = [];
    harmonicGains = [];
    ctx?.close();
    ctx = null;
    masterGain = null;
    noiseGain = null;
  }

  return { update, triggerFractureTransient, setEnabled, dispose };
}
