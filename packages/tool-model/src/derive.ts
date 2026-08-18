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
 * coatingDegradationFraction is now wired too: a blend of the same wear and
 * thermal-damage fractions above - real coating failure has two well-known
 * mechanisms (abrasive wear at the flank, and thermal-cycling adhesion
 * breakdown), so this combines the two real values already computed rather
 * than tracking a third, independent number.
 *
 * builtUpEdgeTendency is wired from three genuinely real, already-existing
 * inputs: this game's own material selection (aluminum vs. titanium, the same
 * distinction manual-campaign.tsx already uses for spindleRpm/programmedFeed),
 * the real coolant.active toggle, and the real spindle load. Built-up edge is
 * a well-documented real phenomenon specifically on aluminum, specifically
 * when cutting dry, specifically at low engagement (light rubbing instead of
 * proper chip shear) - this is the actual mechanism, not a stand-in.
 *
 * runoutContributionMm is still NOT derived: nothing in this game models
 * spindle/holder mechanical runout at all. Wiring it now would mean inventing
 * a number with no real driving input - the same overclaiming problem this
 * codebase has avoided everywhere else. Leave it at ToolState's caller-supplied
 * default until a real runout model exists.
 */
const FLANK_WEAR_LIMIT_MM = 0.3;
/** Above this heat value, the edge is genuinely hot enough to accumulate real thermal damage - below it, no accumulation at all. */
const HOT_HEAT_THRESHOLD = 70;
/** Fraction of remaining headroom (70-100) converted to thermalDamageFraction per tick spent fully pinned at 100 heat - small on purpose, this accumulates over many cuts, not one. */
const THERMAL_DAMAGE_ACCUMULATION_RATE = 0.004;
/** Qualitative blend weights for coatingDegradationFraction - abrasive wear and thermal cycling both degrade coating adhesion, neither alone tells the whole story. */
const COATING_WEAR_WEIGHT = 0.7;
const COATING_THERMAL_WEIGHT = 0.5;

export interface ToolLatentStateInput {
  /** 0-100, the existing manual-mill condition scalar - the single source of truth for wear. */
  condition: number;
  /** 0-100, the existing manual-mill heat scalar. */
  heat: number;
  /** Previous tick's thermalDamageFraction (0..1) - this one field is genuinely cumulative, carried forward tick to tick. */
  previousThermalDamageFraction: number;
  /** True for this game's aluminum-family contracts (6061 AL, 7075-T6) - false for Ti-6Al-4V. Drives builtUpEdgeTendency, a real aluminum-specific phenomenon. */
  aluminumMaterial: boolean;
  /** The real coolant.active toggle - dry cutting on aluminum is the actual BUE risk condition, not flood. */
  coolantActive: boolean;
  spindleOn: boolean;
  /** 0-100, the real spindle load - lower load means light rubbing rather than proper chip shear, the real low-engagement BUE mechanism. */
  load: number;
}

export interface ToolLatentStateResult {
  flankWearMm: Millimeters;
  edgeCondition: EdgeCondition;
  thermalDamageFraction: number;
  coatingDegradationFraction: number;
  builtUpEdgeTendency: number;
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

  const coatingDegradationFraction = clamp01(wearFraction * COATING_WEAR_WEIGHT + thermalDamageFraction * COATING_THERMAL_WEIGHT);

  const builtUpEdgeTendency =
    input.aluminumMaterial && input.spindleOn && !input.coolantActive
      ? clamp01(1 - input.load / 100)
      : 0;

  return {
    flankWearMm,
    edgeCondition: classifyEdgeCondition(input.condition),
    thermalDamageFraction,
    coatingDegradationFraction,
    builtUpEdgeTendency,
  };
}
