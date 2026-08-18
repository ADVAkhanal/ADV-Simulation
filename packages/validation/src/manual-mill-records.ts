import type { ValidationRecord } from "./record.ts";

/**
 * First real ValidationRecord instances, per PRODUCT_SPEC.md §28: "Every major
 * physical/behavioral model ... needs one of these once it has any real
 * implementation." Five models now have real implementations (the manual-mill
 * tool-wear extraction, the chatter model, the coolant model, the tool-model
 * latent-state decomposition, and the procedural-audio derivation) - this file
 * gives each one the honest record it's owed, formalizing what each model's
 * own header comments already say rather than inventing new claims.
 *
 * Every one of these is deliberately "qualitatively-modeled" or
 * "pedagogically-simplified" - none are "physically-modeled" or
 * "empirically-approximated", because none have been fit or validated against
 * real measured machining/acoustic data. Marking any of them higher than that
 * would be exactly the overclaiming this codebase has avoided everywhere else
 * (the trademark-scan correction, the grievance evidence tiers, the honest
 * inert defaults on resonanceBands/coolantAudioActive before their models
 * existed). If a future increment DOES validate one of these against real
 * data (§29's pilot-comparison mechanism, or an actual instrumented cut),
 * update that record's fidelity/validatedRange/errorMetric/sourceData fields -
 * don't add a new record next to a stale one.
 */
export const MANUAL_MILL_VALIDATION_RECORDS: ValidationRecord[] = [
  {
    modelName: "manual-mill-tool-wear",
    modelVersion: "0.1.0",
    purpose: "Per-cut update of tool heat, condition (wear), spindle load, and finish penalty for the manual-mill training surface (applyManualMillCut/applyManualMillCooldown).",
    assumptions: [
      "condition/heat/load are unitless 0-100 scalars tuned for engagement and challenge pacing, not calibrated against measured machining data.",
      "Wear scales linearly with engagement and superlinearly with feed above a 70% override.",
      "A fixture strike applies a fixed wear penalty (14 points) regardless of engagement depth.",
    ],
    inputRange: "engagement roughly 0-10 cells/cut (bounded by tool radius), feed 25-115% override, per-tool toolLoad/toolWear/toolFinish coefficients 0.28-1.35",
    sourceData: "None - hand-tuned for playtested game feel, not fit to measured cutting data. See tests/manual-mill-tool-wear.test.mjs for the exact hand-computed regression values this formula is pinned to (an equivalence check against the pre-extraction inline formula, not an external validation).",
    validatedRange: "N/A - no external validation performed; regression-tested only against its own extracted formula.",
    errorMetric: "N/A - no ground truth exists to compare against.",
    qualitativeExpectations: [
      "More engagement and higher feed increase load and wear.",
      "A fixture strike always causes a large, immediate wear penalty.",
      "Heat sheds faster with the spindle running than idle.",
    ],
    knownLimitations: [
      "A single scalar 'condition' conflates every wear mechanism (flank wear, chipping, thermal damage) - see tool-latent-state-decomposition for the fields that unpack it.",
      "No dependency on real material properties beyond a per-tool coefficient set by hand.",
      "The wear formula's feed-70 kink point is a tuning choice, not derived from any cutting-force model.",
    ],
    outsideRangeBehavior: "All outputs are clamped to their defined range (0-100, or 18-100 for heat); the formula does not diverge outside tested inputs, but its qualitative validity outside the ranges above is unverified.",
    fidelity: "pedagogically-simplified",
  },
  {
    modelName: "manual-mill-chatter",
    modelVersion: "0.1.0",
    purpose: "Classifies cutting instability (chatter) from spindle load relative to a tool's own estimated load ceiling and a caller-normalized tool-stiffness fraction (deriveVibrationState).",
    assumptions: [
      "Instability = excitation x (1 - stiffness), a first-order qualitative proxy, not a modal/frequency-response model.",
      "loadCeiling is estimated analytically from the tool's circular footprint using the SAME constants as the real per-cut load formula (estimateMaxLoadForTool), not measured.",
      "Dominant chatter frequency is placed at 1.5x tooth-pass frequency (between the 1st and 2nd harmonic) as a qualitative placeholder for a real natural-frequency lookup, which does not exist.",
    ],
    inputRange: "load 0-100 (read relative to loadCeiling), toolStiffnessFraction 0-1, spindleRpm/flutes from the real tool roster",
    sourceData: "None - no measured modal/frequency-response data for any real machine/tool/workpiece combination.",
    validatedRange: "N/A",
    errorMetric: "N/A - see PRODUCT_SPEC.md §11's own license: 'qualitative coherence, not universal predictive accuracy.'",
    qualitativeExpectations: [
      "Lower tool stiffness (smaller radius) raises instability, holding load fixed.",
      "Higher load relative to the tool's own ceiling raises instability, holding stiffness fixed.",
      "A perfectly stiff tool (stiffnessFraction=1) never chatters regardless of load.",
      "An idle (spindle off) system never chatters.",
    ],
    knownLimitations: [
      "CHATTER_ONSET_THRESHOLD (0.18) was recalibrated against one in-browser observation (T1 finisher's realistic peak load under sustained max-feed dragging), not a systematic sweep across all tools/contracts.",
      "No resonance/damping-chain model exists; toolStiffnessFraction is a bare tool-radius ratio, not a real N*m/rad stiffness value.",
      "Dominant-frequency placement (1.5x tooth-pass) is illustrative, not derived from any specific machine's structural dynamics.",
      "chatterActive is a hard threshold with no hysteresis - rapid load fluctuation near the threshold could in principle flicker the flag (not yet observed as a UX problem in play, not yet mitigated).",
    ],
    outsideRangeBehavior: "amplitudeFraction is clamped 0-1.",
    fidelity: "qualitatively-modeled",
  },
  {
    modelName: "manual-mill-coolant",
    modelVersion: "0.1.0",
    purpose: "Classifies coolant delivery as steady (flood or dry) vs. intermittent ('dabbing') from a tracked toggle-history count (deriveCoolantState), per grievance.thermal-shock-insert-failure's real framing.",
    assumptions: [
      "Intermittency is measured purely by toggle COUNT within a caller-tracked time window (4 seconds in the current wiring), not by actual coolant flow rate, temperature, or contact area.",
      "Steady flood and steady dry are treated as equally 'adequate' - the risk is attributed specifically to oscillation, not to the on/off choice itself.",
    ],
    inputRange: "recentToggleCount 0 upward (realistic play produces low single digits within the tracked window)",
    sourceData: "None - INTERMITTENT_TOGGLE_THRESHOLD (2) is a qualitative UX tuning knob, not derived from any thermal-cycling failure data.",
    validatedRange: "N/A",
    errorMetric: "N/A",
    qualitativeExpectations: [
      "2 or more toggles within the tracked window is classified as dabbing, regardless of the current on/off state.",
      "A single toggle is never classified as dabbing.",
    ],
    knownLimitations: [
      "concentrationInRange and nozzlePositionOk are hardcoded true - no concentration or nozzle-aim model exists anywhere in this codebase.",
      "The 4-second window and toggle-count threshold are unvalidated design choices, chosen for legible in-game pacing, not matched to any real thermal-shock timescale.",
    ],
    outsideRangeBehavior: "flowAdequate is a boolean from a simple count comparison; no clamping issues possible.",
    fidelity: "qualitatively-modeled",
  },
  {
    modelName: "tool-latent-state-decomposition",
    modelVersion: "0.1.0",
    purpose: "Decomposes the manual-mill's single 0-100 condition scalar into four of ToolState's §7 latent fields (flankWearMm, edgeCondition, thermalDamageFraction, coatingDegradationFraction, builtUpEdgeTendency) - deriveToolLatentState/classifyEdgeCondition.",
    assumptions: [
      "flankWearMm assumes a linear map from condition to a 0.3mm VBmax failure criterion - a real, commonly-cited flank-wear limit in general machining practice, but this game's 'condition' scalar itself is not derived from any measured wear-rate model.",
      "coatingDegradationFraction assumes coating failure is a linear blend of abrasive wear (weight 0.7) and thermal cycling (weight 0.5) - the two contributing mechanisms are real, but the specific weights are qualitative choices.",
      "builtUpEdgeTendency assumes BUE risk exists only for aluminum-family materials, only when cutting dry, only while the spindle is on, and scales inversely with load - a simplified proxy for a phenomenon that in reality also depends on cutting SPEED (not modeled here) and specific alloy chemistry (not modeled here).",
    ],
    inputRange: "condition/heat 0-100, load 0-100, aluminumMaterial/coolantActive/spindleOn booleans",
    sourceData: "No external validation data exists for this game's own formula. VBmax (0.3mm) is a standard general-machining flank-wear failure criterion cited widely in machining references - a real reference value, used here only to give an arcade scalar a real unit.",
    validatedRange: "N/A - no measured tool-wear data exists for this formula.",
    errorMetric: "N/A",
    qualitativeExpectations: [
      "flankWearMm and edgeCondition depend only on condition, never on heat or any other input.",
      "thermalDamageFraction never decreases on its own and only accumulates while heat is above 70.",
      "builtUpEdgeTendency is 0 for titanium, 0 when coolant is active, 0 when the spindle is off, and highest at low load on dry aluminum.",
    ],
    knownLimitations: [
      "runoutContributionMm remains completely unwired - no spindle/holder mechanical-runout model exists anywhere in this codebase.",
      "builtUpEdgeTendency ignores cutting speed entirely, despite real BUE onset being strongly speed-dependent.",
      "coatingDegradationFraction's blend weights (0.7/0.5) are qualitative choices, not fit to any real coating-life data.",
    ],
    outsideRangeBehavior: "All fractional outputs are clamped 0-1; flankWearMm is bounded implicitly by condition's own 0-100 clamp in the upstream tool-wear model.",
    fidelity: "qualitatively-modeled",
  },
  {
    modelName: "procedural-audio-derivation",
    modelVersion: "0.1.0",
    purpose: "Derives all AcousticState fields (harmonics, broadband noise, resonance bands, coolant hiss level, fracture transients) from real simulation telemetry for real-time synthesis (deriveAcousticState).",
    assumptions: [
      "Harmonic amplitude scales linearly with load fraction; higher-harmonic content scales with wear fraction - both are 'sounds coherent' choices, not derived from any acoustic measurement of real cutting.",
      "resonanceBands are populated 1:1 from the chatter model's own (unvalidated) output - there is no independent acoustic validation of chatter audibility.",
      "coolantAudioActive is a direct pass-through of the real coolant.active state - a level toggle only; noise 'color'/rate is fixed, not state-driven yet.",
    ],
    inputRange: "spindleRpm/fluteCount from the real tool roster, load/heat/condition 0-100, vibration/coolant snapshots from their own models",
    sourceData: "None - no acoustic recordings or frequency-domain analysis of any real cutting/chatter/coolant sound were used. The synthesis TECHNIQUE (summed sine oscillators plus LFSR noise) is carried over from the sibling ADV-WI-Studio repo's chiptune-synth package, applied to a new domain.",
    validatedRange: "N/A",
    errorMetric: "N/A - PRODUCT_SPEC.md §12 asks for qualitative coherence ('different failure modes must sound different'), not acoustic accuracy.",
    qualitativeExpectations: [
      "Higher load raises the fundamental harmonic's amplitude.",
      "Degraded condition adds more high-harmonic content without any separate 'danger' input.",
      "Higher heat raises broadband noise for the same load.",
      "A spinning-but-idle spindle has a rotation tone but no cutting noise or chip impacts.",
    ],
    knownLimitations: [
      "No perceptual/listening validation has been performed - the qualitative expectations above are verified as numeric properties of the derivation function, not as 'does this sound right' to a human listener.",
      "Live rAF-loop behavior could not be observed directly in this project's automated browser test sandbox (document.hidden stays true even when the tab is fronted, which throttles requestAnimationFrame) - verification relied on unit tests plus replicating live-measured telemetry through the exported functions outside the browser.",
      "Coolant noise 'color' and cutting-noise 'color' are both fixed LFSR periods; only level is state-driven.",
    ],
    outsideRangeBehavior: "All amplitude/level fields are clamped 0-1 or a documented sub-fraction; frequencies collapse to 0 when the spindle is off.",
    fidelity: "qualitatively-modeled",
  },
];
