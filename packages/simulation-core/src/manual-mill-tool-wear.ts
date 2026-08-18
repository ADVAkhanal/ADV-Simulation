/**
 * Byte-for-byte port of the tool-wear/heat/load/finish-penalty formulas
 * currently inline in ADV-Simulation's app/manual-campaign.tsx (see
 * docs/EXTRACTION_PLAN.md). Same constants, same order of operations, on
 * purpose - this pass separates the ARCHITECTURE (pure function + explicit
 * state vs. five scattered useState calls) from any TUNING change. Do not
 * "improve" these numbers here; if the formula itself needs to change later,
 * that is a distinct, separately-reviewable increment.
 *
 * This does not yet satisfy PRODUCT_SPEC.md §7's "tool condition is not a
 * single health scalar" requirement - `condition` here is still the original
 * 0-100 scalar. Decomposing it into ToolState's flankWearMm/edgeCondition is
 * the fidelity upgrade that comes in the NEXT increment, once this port is
 * verified not to have changed anything.
 */

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export interface ManualMillToolState {
  heat: number;
  condition: number;
  load: number;
  finishPenalty: number;
}

export interface ManualMillCutInputs {
  engagement: number;
  overcut: number;
  fixtureStrikes: number;
  correct: number;
  toolLoad: number;
  toolWear: number;
  toolFinish: number;
  feed: number;
  operationIsFinish: boolean;
}

export interface ManualMillCutResult {
  nextState: ManualMillToolState;
  /** True exactly when condition crosses from >0 to <=0 on this cut - the trigger for the existing "TOOL FAILURE" message and breaks counter. */
  toolBroke: boolean;
}

/** Ported from manual-campaign.tsx's cutAt(), the per-cut update block (lines ~420-460 at extraction time). */
export function applyManualMillCut(state: ManualMillToolState, inputs: ManualMillCutInputs): ManualMillCutResult {
  const nextLoad = clamp(Math.round(inputs.engagement * 7.6 * inputs.toolLoad * (inputs.feed / 55)), 0, 100);
  const heatGain = inputs.engagement * 0.45 * inputs.toolLoad * (inputs.feed / 50);
  const wear = inputs.engagement * 0.055 * inputs.toolWear * (1 + Math.max(0, inputs.feed - 70) / 35) + inputs.fixtureStrikes * 14;

  const heat = clamp(state.heat + heatGain, 18, 100);
  const condition = clamp(state.condition - wear, 0, 100);
  const toolBroke = condition <= 0 && state.condition > 0;

  const finishPenalty = inputs.operationIsFinish
    ? Math.max(0, state.finishPenalty - inputs.correct * 0.075)
    : state.finishPenalty + Math.max(0, nextLoad - 82) * 0.018 * inputs.toolFinish + inputs.overcut * 0.25;

  return { nextState: { heat, condition, load: nextLoad, finishPenalty }, toolBroke };
}

/** Ported from the 1000ms cooldown interval (lines ~201-208 at extraction time). Called once per tick while cutting screen is active and not paused. */
export function applyManualMillCooldown(state: ManualMillToolState, spindleOn: boolean): ManualMillToolState {
  return {
    ...state,
    heat: clamp(state.heat - (spindleOn ? 0.35 : 2.4), 18, 100),
    load: Math.max(0, state.load - 4),
  };
}

/**
 * A tool's realistic peak spindle-load ceiling under a given feed override -
 * the same nextLoad formula and constants as applyManualMillCut above (7.6,
 * /55), fed the tool's full circular footprint (pi * radius^2) as the
 * theoretical maximum engagement instead of a real per-cut engagement value.
 * Exists so callers (the chatter model) can express "how loaded is this tool
 * relative to what IT can realistically reach" instead of against a fixed
 * 0-100 scale a small-radius tool can never approach - see chatter.ts's own
 * header note. Deliberately reuses these exact constants rather than
 * duplicating them, so the ceiling can never silently drift from the real
 * per-cut formula it's estimating a bound for.
 */
export function estimateMaxLoadForTool(toolRadius: number, toolLoadCoefficient: number, feedOverridePercent: number): number {
  const maxEngagement = Math.PI * toolRadius * toolRadius;
  return clamp(Math.round(maxEngagement * 7.6 * toolLoadCoefficient * (feedOverridePercent / 55)), 1, 100);
}

/** Ported from restoreTool() (line ~485 at extraction time) - the free, failure-triggered recovery path. Heat resets to 25, not 20; this asymmetry with swapManualMillTool is in the original code and is preserved deliberately, not a bug. */
export function restoreManualMillTool(): { heat: number; condition: number } {
  return { heat: 25, condition: 100 };
}

/** Ported from swapTool() (line ~586 at extraction time) - the paid, deliberate tool-change path. Heat resets to 20. */
export function swapManualMillTool(): { heat: number; condition: number } {
  return { heat: 20, condition: 100 };
}
