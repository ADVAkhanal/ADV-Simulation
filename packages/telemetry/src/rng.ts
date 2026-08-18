/**
 * Seeded PRNG (mulberry32) for all assessment-relevant randomness.
 *
 * Per PRODUCT_SPEC.md §5: "Never call uncontrolled Math.random() inside assessed
 * simulation behavior." This is the only allowed source of randomness for anything
 * that feeds into a ShopGrievance trigger, a tool-wear stochastic component, or
 * assessment evidence. Non-assessed cosmetic randomness (if any is ever needed) may
 * still use Math.random() directly, but should not be mixed with this module.
 *
 * `derive()` exists so independent subsystems (tool-wear noise vs. a grievance's
 * stochastic trigger vs. acoustic micro-jitter) can each get their own
 * reproducible stream without one subsystem's extra/fewer draws shifting another
 * subsystem's sequence - a classic source of "reproducible in isolation, not
 * reproducible once you add a feature" bugs.
 */
export interface SeededRng {
  readonly seed: number;
  next(): number; // [0, 1)
  nextInRange(min: number, max: number): number;
  nextInt(minInclusive: number, maxExclusive: number): number;
  /** Deterministically derives an independent child stream from a string label. */
  derive(label: string): SeededRng;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash, used only to turn a derive() label into a seed offset - not cryptographic. */
function hashLabel(label: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < label.length; i++) {
    hash ^= label.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createSeededRng(seed: number): SeededRng {
  const next = mulberry32(seed);
  return {
    seed,
    next,
    nextInRange(min: number, max: number) {
      return min + next() * (max - min);
    },
    nextInt(minInclusive: number, maxExclusive: number) {
      return Math.floor(minInclusive + next() * (maxExclusive - minInclusive));
    },
    derive(label: string) {
      // Combine parent seed with the label hash - deterministic, and distinct
      // labels reliably produce distinct child streams.
      return createSeededRng((seed ^ hashLabel(label)) >>> 0);
    },
  };
}
