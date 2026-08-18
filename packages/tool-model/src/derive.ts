import { type Millimeters, mm } from "@adv-simulation/units/src/index.ts";
import type { EdgeCondition } from "./index.ts";

/**
 * First real decomposition of the manual-mill's single 0-100 `condition`
 * scalar into ToolState's §7 latent fields - the increment
 * manual-mill-tool-wear.ts's own header comment has been deferring since the
 * extraction increment ("Decomposing it into ToolState's flankWearMm/
 * edgeCondition is the fidelity upgrade that comes in the NEXT increment").
 *
 * flankWearMm and edgeCondition are DERIVED PRESENTATIONS of the existing
 * condition scalar, not a second, independently-accumulating wear model -
 * condition stays the single source of truth (still drives TOOL FAILURE/
 * toolBroke and every existing test unchanged). FLANK_WEAR_LIMIT_MM (0.3mm) is
 * a standard flank-wear failure criterion (VBmax) used broadly across general
 * machining practice - real engineering reference, used here to give the
 * existing scalar a real unit, not to invent a second number.
 *
 * thermalDamageFraction is genuinely different: it is cumulative (this tool's
 * running exposure to overheating), which condition/heat are not (heat sheds
 * back down via cooldown). It only rises while heat is meaningfully above the
 * threshold below, and never resets except when a fresh tool is loaded (see
 * manual-campaign.tsx's restoreTool/swapTool). The threshold and rate are
 * qualitative tuning knobs, not a validated thermal-cycling model - same
 * license PRODUCT_SPEC.md §11 gives the chatter model.
 *
 * builtUpEdgeTendency, coatingDegradationFraction, and runoutContributionMm
 * are deliberately NOT derived here: nothing in this game currently models
 * cutting speed vs. material stickiness (BUE), per-tool coating type, or
 * spindle/holder runout. Wiring them now would mean inventing plausible
 * numbers with no real driving input - the same overclaiming problem this
 * codebase has avoided everywhere else (grievances, resonanceBands,
 * coolantAudioActive before their own real models existed). Leave them at
 * ToolState's caller-supplied defaults until real inputs exist.
 */
const FLANK_WEAR_LIMIT_MM = 0.3;
/** Above this heat value, the edge is genuinely hot enough to accumulate real thermal damage - below it, no accumulation at all. */
const HOT_HEAT_THRESHOLD = 70;
/** Fraction of remaining headroom (70-100) converted to thermalDamageFraction per tick spent fully pinned at 100 heat - small on purpose, this accumulates over many cuts, not one. */
const THERMAL_DAMAGE_ACCUMULATION_RATE = 0.004;

export interface ToolLatentStateInput {
  /** 0-100, the existing manual-mill condition scalar - the single source of truth for wear. */
  condition: number;
  /** 0-100, the existing manual-mill heat scalar. */
  heat: number;
  /** Previous tick's thermalDamageFraction (0..1) - this one field is genuinely cumulative, carried forward tick to tick. */
  previousThermalDamageFraction: number;
}

export interface ToolLatentStateResult {
  flankWearMm: Millimeters;
  edgeCondition: EdgeCondition;
  thermalDamageFraction: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function classifyEdgeCondition(condition: number): EdgeCondition {
  if (condition <= 0) return "fractured";
  if (condition < 40) return "chipped";
  if (condition < 80) return "worn";
  return "sharp";
}

export function deriveToolLatentState(input: ToolLatentStateInput): ToolLatentStateResult {
  const wearFraction = clamp01(1 - input.condition / 100);
  const flankWearMm = mm(wearFraction * FLANK_WEAR_LIMIT_MM);

  const heatAboveThreshold = Math.max(0, input.heat - HOT_HEAT_THRESHOLD);
  const headroom = 100 - HOT_HEAT_THRESHOLD;
  const thermalDamageFraction = clamp01(
    input.previousThermalDamageFraction + (heatAboveThreshold / headroom) * THERMAL_DAMAGE_ACCUMULATION_RATE,
  );

  return {
    flankWearMm,
    edgeCondition: classifyEdgeCondition(input.condition),
    thermalDamageFraction,
  };
}
