import type { CoolantState } from "./state.ts";

/**
 * First real coolant model. Unblocks grievance.thermal-shock-insert-failure
 * (see grievances-data.ts): "Coolant is applied intermittently to a hot
 * cutting edge rather than continuously (flood) or not at all (dry)." The
 * risk that grievance describes is specifically INTERMITTENT contact - a
 * steady flood strategy and a steady dry strategy are both fine per the
 * grievance's own framing, so flowAdequate below classifies steadiness, not
 * which strategy was chosen.
 *
 * concentrationInRange and nozzlePositionOk stay at their honest inert
 * default (always true) because nothing in this codebase models coolant
 * concentration or nozzle aim yet - same pattern as chatter.ts's
 * toolStiffnessFraction note and procedural-audio's resonanceBands/
 * coolantAudioActive notes before their own models landed. Wire these for
 * real once those systems exist; don't invent them now.
 */
export interface CoolantDerivationInput {
  /** Whether coolant is currently commanded on - a real operator toggle, not inferred from spindle state. */
  active: boolean;
  /**
   * Count of on/off transitions of `active` within the caller's own recent
   * time window (e.g. the last few seconds) - the caller (the game) owns
   * tracking that history; this function only classifies the count.
   */
  recentToggleCount: number;
}

/** At or above this many transitions in the caller's tracked window, coolant contact is "dabbing," not a steady strategy - a qualitative tuning knob, not a validated thermal-cycling threshold. */
const INTERMITTENT_TOGGLE_THRESHOLD = 2;

export function deriveCoolantState(input: CoolantDerivationInput): CoolantState {
  return {
    active: input.active,
    flowAdequate: input.recentToggleCount < INTERMITTENT_TOGGLE_THRESHOLD,
    concentrationInRange: true,
    nozzlePositionOk: true,
  };
}
