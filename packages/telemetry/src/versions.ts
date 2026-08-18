/**
 * Every reproducible run is defined by this full version set, per PRODUCT_SPEC.md
 * §5: "Same versions + same seed + same actions must reproduce the same
 * assessment-relevant outcome within explicitly documented numerical tolerances."
 *
 * All fields are required (no optionals) on purpose - an assessment report missing
 * even one of these is not reproducible, and that should be a type error, not a
 * runtime surprise discovered during a dispute over a learner's result.
 */
export interface RunVersionSet {
  simulatorVersion: string;
  simulationCoreVersion: string;
  machineProfileVersion: string;
  scenarioVersion: string;
  rubricVersion: string;
  materialProfileVersion: string;
  toolProfileVersion: string;
  /** Feature/config flags active for this run - anything that could change behavior belongs here. */
  configFlags: Record<string, string | number | boolean>;
}

export interface RunProvenance {
  seed: number;
  versions: RunVersionSet;
  startedAt: string; // ISO 8601 - stamped by the caller, never Date.now() inside deterministic code
}
