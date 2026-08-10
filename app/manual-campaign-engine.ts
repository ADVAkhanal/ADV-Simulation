export const MILL_COLS = 28;
export const MILL_ROWS = 16;
export const MILL_CELLS = MILL_COLS * MILL_ROWS;

export type ManualContractId = "drive" | "rib" | "bracket";
export type ManualOperationId = "profile" | "pocket" | "drill" | "finish";
export type InspectionInstrumentId = "touch-probe" | "bore-gauge" | "profilometer";
export type InspectionDisposition = "accept" | "rework" | "scrap";

export type ManualOperation = {
  id: ManualOperationId;
  label: string;
  instruction: string;
  requiredProgress: number;
};

export type InspectionCharacteristic = {
  id: string;
  label: string;
  instrument: InspectionInstrumentId;
  instrumentLabel: string;
  nominal: number;
  tolerance: number;
  unit: string;
  source: "geometry" | "feature" | "finish";
};

export type ManualContract = {
  id: ManualContractId;
  program: string;
  client: string;
  title: string;
  brief: string;
  material: string;
  reward: number;
  par: number;
  tolerance: number;
  color: string;
  operations: ManualOperation[];
  inspection: InspectionCharacteristic[];
};

export type MillTool = {
  id: number;
  name: string;
  diameter: string;
  radius: number;
  load: number;
  wear: number;
  finish: number;
  removal: number;
  role: string;
  operations: ManualOperationId[];
  limitation: string;
};

export type ManualMeasurement = InspectionCharacteristic & {
  actual: number;
  deviation: number;
  pass: boolean;
};

export type ManualGrade = {
  completion: number;
  geometry: number;
  precision: number;
  finish: number;
  time: number;
  inspection: number;
  breakPenalty: number;
  score: number;
  accepted: boolean;
  rank: "S" | "A" | "B" | "C" | "REWORK";
  payout: number;
};

export type ManualMastery = { attempts: number; bestScore: number; bestRank: ManualGrade["rank"]; accepted: boolean };
export type ShopBestRun = { score: number; precision: number; completion: number; elapsed: number; geometry?: number; finish?: number; time?: number };
export type ShopRunLogEntry = { id: string; contract: ManualContractId; program: string; title: string; score: number; rank: string; accepted: boolean; completion: number; precision: number; finish: number; elapsed: number; overcut: number; at: number };

export type ManualSaveData = {
  version: 3;
  credits: number;
  reputation: number;
  cleared: ManualContractId[];
  totalAttempts: number;
  mastery: Partial<Record<ManualContractId, ManualMastery>>;
  bests: Partial<Record<ManualContractId, ShopBestRun>>;
  log: ShopRunLogEntry[];
};

const PROFILE: ManualOperation = { id: "profile", label: "Profile", instruction: "Release the outside contour without crossing the keep line.", requiredProgress: 90 };
const POCKET: ManualOperation = { id: "pocket", label: "Pocket", instruction: "Clear the internal lightening cavities before finishing the perimeter.", requiredProgress: 88 };
const DRILL: ManualOperation = { id: "drill", label: "Drill", instruction: "Plunge the called-out bores; lateral milling is locked out for this tool.", requiredProgress: 90 };
const FINISH: ManualOperation = { id: "finish", label: "Finish", instruction: "Trace the surviving boundary with the finishing cutter.", requiredProgress: 82 };

const INSPECTION_INSTRUMENTS: Record<InspectionInstrumentId, string> = {
  "touch-probe": "Touch probe",
  "bore-gauge": "Bore gauge",
  profilometer: "Surface comparator",
};

function characteristic(id: string, label: string, instrument: InspectionInstrumentId, tolerance: number, source: InspectionCharacteristic["source"]): InspectionCharacteristic {
  return { id, label, instrument, instrumentLabel: INSPECTION_INSTRUMENTS[instrument], nominal: 0, tolerance, unit: "SIM", source };
}

export const MANUAL_CONTRACTS: ManualContract[] = [
  {
    id: "drive", program: "NS-0142-A", client: "NORTHSTAR MOBILITY", title: "Emergency drive plate",
    brief: "Profile the drivetrain interface, drill the five-hole pattern, then prove the edge before the sunrise rig test.",
    material: "6061 AL", reward: 1700, par: 75, tolerance: 3, color: "#50e6ff", operations: [PROFILE, DRILL, FINISH],
    inspection: [characteristic("drive-profile", "Profile deviation", "touch-probe", .18, "geometry"), characteristic("drive-bores", "Bore position", "bore-gauge", .14, "feature"), characteristic("drive-finish", "Edge finish index", "profilometer", .22, "finish")],
  },
  {
    id: "rib", program: "KS-2207-R", client: "KESTREL AEROSPACE", title: "Flight rib prototype",
    brief: "Pocket three lightening bays, release the tapered profile, and finish the load path without thinning a web.",
    material: "7075-T6", reward: 2450, par: 92, tolerance: 2, color: "#d8ff3e", operations: [POCKET, PROFILE, FINISH],
    inspection: [characteristic("rib-pockets", "Pocket web deviation", "touch-probe", .14, "feature"), characteristic("rib-profile", "Span profile deviation", "touch-probe", .12, "geometry"), characteristic("rib-finish", "Load-path finish index", "profilometer", .18, "finish")],
  },
  {
    id: "bracket", program: "OR-771-C", client: "ORBITAL RESEARCH", title: "Sensor bracket",
    brief: "Release the asymmetric bracket, drill the optical datum features, and finish the boss without dimensional damage.",
    material: "Ti-6Al-4V", reward: 3200, par: 110, tolerance: 1, color: "#ff6ea9", operations: [PROFILE, DRILL, FINISH],
    inspection: [characteristic("bracket-profile", "Datum profile deviation", "touch-probe", .10, "geometry"), characteristic("bracket-bore", "Optical bore position", "bore-gauge", .08, "feature"), characteristic("bracket-finish", "Boss finish index", "profilometer", .14, "finish")],
  },
];

export const MILL_TOOLS: MillTool[] = [
  { id: 1, name: "FINISHER", diameter: "6 MM", radius: .78, load: .62, wear: .72, finish: .28, removal: .58, role: "Low load and tight access", operations: ["profile", "finish"], limitation: "Slow bulk removal; cannot pocket or drill." },
  { id: 2, name: "ROUGHER", diameter: "12 MM", radius: 1.35, load: 1, wear: 1, finish: .9, removal: 1, role: "Fast profile and pocket removal", operations: ["profile", "pocket"], limitation: "Cannot enter drilled features or certify a finish pass." },
  { id: 3, name: "DRILL", diameter: "8 MM", radius: .72, load: 1.24, wear: .82, finish: 1.2, removal: 1.35, role: "Fast axial feature making", operations: ["drill"], limitation: "Plunge-only; lateral profile and pocket cuts are locked out." },
];

export const DEFAULT_MANUAL_SAVE: ManualSaveData = { version: 3, credits: 250, reputation: 0, cleared: [], totalAttempts: 0, mastery: {}, bests: {}, log: [] };

function driveFeatures(x: number, y: number) {
  const center = Math.hypot(x, y) < 2.5;
  const bolts = [[-6, -3.2], [6, -3.2], [-6, 3.2], [6, 3.2]].some(([bx, by]) => Math.hypot(x - bx, y - by) < 1);
  return { center, bolts };
}

function ribFeatures(x: number, y: number) {
  return { lightening: [-6, 0, 6].some((cx) => Math.hypot((x - cx) / 2.1, y / 1.65) < 1) };
}

function bracketFeatures(x: number, y: number) {
  return { bore: Math.hypot(x - 5.7, y - 1.1) < 1.35, datum: Math.hypot(x + 6.4, y - 2.8) < 1.1 };
}

export function isManualTarget(contract: ManualContractId, col: number, row: number) {
  const x = col - (MILL_COLS - 1) / 2;
  const y = row - (MILL_ROWS - 1) / 2;
  if (contract === "drive") {
    const outer = Math.abs(x) <= 9.7 && Math.abs(y) <= 5.3 && Math.abs(x) + Math.abs(y) <= 13.2;
    const { center, bolts } = driveFeatures(x, y);
    return outer && !center && !bolts;
  }
  if (contract === "rib") {
    const span = Math.abs(x) <= 11.5;
    const envelope = span && Math.abs(y) <= 2.3 + (1 - Math.abs(x) / 12) * 2.8;
    return envelope && !ribFeatures(x, y).lightening;
  }
  const vertical = x >= -9 && x <= -4 && y >= -5.5 && y <= 5.5;
  const base = x >= -9 && x <= 8.5 && y >= 1 && y <= 5.5;
  const boss = Math.hypot(x - 5.7, y - 1.1) < 3.1;
  const { bore, datum } = bracketFeatures(x, y);
  return (vertical || base || boss) && !bore && !datum;
}

export function manualCellOperation(contract: ManualContractId, col: number, row: number): Exclude<ManualOperationId, "finish"> | null {
  if (isManualTarget(contract, col, row)) return null;
  const x = col - (MILL_COLS - 1) / 2;
  const y = row - (MILL_ROWS - 1) / 2;
  if (contract === "drive") {
    const feature = driveFeatures(x, y);
    return feature.center || feature.bolts ? "drill" : "profile";
  }
  if (contract === "rib") return ribFeatures(x, y).lightening ? "pocket" : "profile";
  const feature = bracketFeatures(x, y);
  return feature.bore || feature.datum ? "drill" : "profile";
}

export function isManualBoundary(contract: ManualContractId, col: number, row: number) {
  if (!isManualTarget(contract, col, row)) return false;
  return [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => {
    const nextCol = col + dx; const nextRow = row + dy;
    return nextCol < 0 || nextCol >= MILL_COLS || nextRow < 0 || nextRow >= MILL_ROWS || !isManualTarget(contract, nextCol, nextRow);
  });
}

export function createManualStock() { return new Uint8Array(MILL_CELLS).fill(1); }
export function createManualFinishMap() { return new Uint8Array(MILL_CELLS); }

// The vise clamps the stock's outer perimeter from below the top surface.
// A pass that cuts all the way to the stock's edge risks striking that
// clamp - a real fixture collision, distinct from an overcut into the part.
export function isFixtureZone(col: number, row: number) {
  return col === 0 || col === MILL_COLS - 1 || row === 0 || row === MILL_ROWS - 1;
}

export function cutManualStock(source: Uint8Array, contract: ManualContractId, cutterX: number, cutterY: number, radius: number) {
  const material = source.slice();
  let correct = 0; let overcut = 0; let engagement = 0; let fixtureStrikes = 0;
  for (let row = 0; row < MILL_ROWS; row += 1) for (let col = 0; col < MILL_COLS; col += 1) {
    const index = row * MILL_COLS + col;
    if (!material[index] || Math.hypot(col - cutterX, row - cutterY) > radius) continue;
    material[index] = 0; engagement += 1;
    if (isFixtureZone(col, row)) fixtureStrikes += 1;
    if (isManualTarget(contract, col, row)) overcut += 1; else correct += 1;
  }
  return { material, correct, overcut, engagement, fixtureStrikes };
}

export function machineManualStock(
  source: Uint8Array,
  finishSource: Uint8Array,
  contract: ManualContractId,
  operation: ManualOperationId,
  tool: MillTool,
  cutterX: number,
  cutterY: number,
) {
  const material = source.slice();
  const finished = finishSource.slice();
  if (!tool.operations.includes(operation)) return { material, finished, correct: 0, overcut: 0, engagement: 0, mismatch: 0, fixtureStrikes: 0, compatible: false };
  let correct = 0; let overcut = 0; let engagement = 0; let mismatch = 0; let fixtureStrikes = 0;
  for (let row = 0; row < MILL_ROWS; row += 1) for (let col = 0; col < MILL_COLS; col += 1) {
    if (Math.hypot(col - cutterX, row - cutterY) > tool.radius) continue;
    const index = row * MILL_COLS + col;
    if (isFixtureZone(col, row)) fixtureStrikes += 1;
    if (operation === "finish") {
      if (material[index] && isManualBoundary(contract, col, row) && !finished[index]) {
        finished[index] = 1; correct += 1; engagement += 1;
      }
      continue;
    }
    if (!material[index]) continue;
    if (isManualTarget(contract, col, row)) {
      material[index] = 0; overcut += 1; engagement += 1;
    } else if (manualCellOperation(contract, col, row) === operation) {
      material[index] = 0; correct += 1; engagement += 1;
    } else {
      mismatch += 1;
    }
  }
  return { material, finished, correct, overcut, engagement, mismatch, fixtureStrikes, compatible: true };
}

export function manualCompletion(material: Uint8Array, contract: ManualContractId) {
  let removed = 0; let required = 0;
  for (let index = 0; index < MILL_CELLS; index += 1) {
    const col = index % MILL_COLS; const row = Math.floor(index / MILL_COLS);
    if (!isManualTarget(contract, col, row)) { required += 1; if (!material[index]) removed += 1; }
  }
  return Math.min(100, Math.round(removed / Math.max(1, required) * 100));
}

export function manualOperationProgress(material: Uint8Array, finished: Uint8Array, contract: ManualContractId, operation: ManualOperationId) {
  let completed = 0; let required = 0;
  for (let index = 0; index < MILL_CELLS; index += 1) {
    const col = index % MILL_COLS; const row = Math.floor(index / MILL_COLS);
    const isRequired = operation === "finish" ? isManualBoundary(contract, col, row) : manualCellOperation(contract, col, row) === operation;
    if (!isRequired) continue;
    required += 1;
    if (operation === "finish" ? finished[index] : !material[index]) completed += 1;
  }
  return Math.min(100, Math.round(completed / Math.max(1, required) * 100));
}

export function allManualOperationsComplete(material: Uint8Array, finished: Uint8Array, contract: ManualContract) {
  return contract.operations.every((operation) => manualOperationProgress(material, finished, contract.id, operation.id) >= operation.requiredProgress);
}

export function buildManualMeasurements(
  material: Uint8Array,
  finished: Uint8Array,
  contract: ManualContract,
  overcut: number,
  finishPenalty: number,
  breaks: number,
): ManualMeasurement[] {
  const completion = manualCompletion(material, contract.id);
  const drill = manualOperationProgress(material, finished, contract.id, "drill");
  const pocket = manualOperationProgress(material, finished, contract.id, "pocket");
  const finish = manualOperationProgress(material, finished, contract.id, "finish");
  return contract.inspection.map((item) => {
    let deviation = 0;
    if (item.source === "geometry") deviation = overcut * .045 + Math.max(0, 94 - completion) * .009;
    if (item.source === "feature") {
      const featureProgress = contract.operations.some((operation) => operation.id === "drill") ? drill : pocket;
      deviation = Math.max(0, 96 - featureProgress) * .008 + overcut * .018;
    }
    if (item.source === "finish") deviation = finishPenalty * .014 + Math.max(0, 90 - finish) * .006 + breaks * .025;
    deviation = Number(deviation.toFixed(3));
    return { ...item, actual: deviation, deviation, pass: deviation <= item.tolerance };
  });
}

export function recommendedManualDisposition(measurements: ManualMeasurement[], contract: ManualContract, overcut: number): InspectionDisposition {
  if (overcut > contract.tolerance) return "scrap";
  if (measurements.some((measurement) => !measurement.pass)) return "rework";
  return "accept";
}

export function evaluateManualDisposition(chosen: InspectionDisposition, recommended: InspectionDisposition, measuredCount: number, totalCount: number) {
  const complete = totalCount > 0 && measuredCount === totalCount;
  const correct = complete && chosen === recommended;
  return { complete, correct, inspectionScore: correct ? 10 : complete ? 4 : 0 };
}

export function deriveManualMission(completion: number) {
  if (completion < 35) return { step: 1, target: 35, title: "OPEN THE STOCK", detail: "Establish a safe removal lane without touching the glowing profile." };
  if (completion < 70) return { step: 2, target: 70, title: "CONTROL THE ENGAGEMENT", detail: "Clear the open field while keeping simulated load below the red band." };
  if (completion < 90) return { step: 3, target: 90, title: "PROTECT THE EDGE", detail: "Switch strategy near constrained geometry and preserve the part boundary." };
  return { step: 4, target: 100, title: "INSPECT THE PART", detail: "The release threshold is met. Stop the spindle and run inspection." };
}

export function deriveFlowPoints(correctCells: number, chain: number) {
  const multiplier = 1 + Math.min(Math.max(0, chain), 20) * .05;
  return { multiplier, points: Math.max(0, Math.round(correctCells * 100 * multiplier)) };
}

export function deriveMasteryRank(score: number) { return score >= 96 ? "S" : score >= 88 ? "A" : score >= 76 ? "B" : "C"; }

export function gradeManualRun(
  material: Uint8Array,
  contract: ManualContract,
  overcut: number,
  finishPenalty: number,
  elapsed: number,
  breaks: number,
  fixtureStrikes = 0,
  inspectionScore = 10,
  operationsComplete = true,
): ManualGrade {
  const completion = manualCompletion(material, contract.id);
  const geometry = Math.min(46, completion / 90 * 46);
  const precision = Math.max(0, 30 - overcut * (contract.id === "bracket" ? 5 : 3.2));
  const finish = Math.max(0, 14 - finishPenalty * 1.3);
  const time = Math.max(0, 10 - Math.max(0, elapsed - contract.par) * .1);
  const breakPenalty = breaks * 5 + fixtureStrikes * 6;
  const score = Math.max(0, Math.min(100, Math.round(geometry + precision + finish + time + inspectionScore - breakPenalty)));
  const accepted = operationsComplete && completion >= 90 && overcut <= contract.tolerance && fixtureStrikes === 0;
  const rank: ManualGrade["rank"] = !accepted ? "REWORK" : score >= 96 ? "S" : score >= 88 ? "A" : score >= 76 ? "B" : "C";
  return {
    completion,
    geometry: Math.round(geometry),
    precision: Math.round(precision),
    finish: Math.round(finish),
    time: Math.round(time),
    inspection: inspectionScore,
    breakPenalty,
    score,
    accepted,
    rank,
    payout: accepted ? Math.round(contract.reward * (.55 + score / 220)) : 120,
  };
}

export function deriveShopSkillProgress(bests: Record<string, ShopBestRun>, thresholds = [0, 70, 165, 250]) {
  const runs = Object.values(bests), xp = runs.reduce((sum, run) => sum + run.score, 0);
  const average = (read: (run: ShopBestRun) => number) => runs.length ? Math.round(runs.reduce((sum, run) => sum + read(run), 0) / runs.length) : 0;
  const skills = [
    { label: "GEOMETRY CONTROL", value: average((run) => run.geometry !== undefined ? run.geometry / 46 * 100 : run.completion) },
    { label: "INSPECTION DISCIPLINE", value: average((run) => run.precision / 30 * 100) },
    { label: "PROCESS CONTROL", value: average((run) => run.finish !== undefined ? run.finish / 14 * 100 : 0) },
    { label: "CYCLE DISCIPLINE", value: average((run) => run.time !== undefined ? run.time / 10 * 100 : 0) },
  ];
  const currentIndex = thresholds.reduce((found, threshold, index) => xp >= threshold ? index : found, 0);
  const currentThreshold = thresholds[currentIndex] ?? 0, nextThreshold = thresholds[currentIndex + 1] ?? null;
  const progress = nextThreshold === null ? 100 : Math.max(0, Math.min(100, (xp - currentThreshold) / (nextThreshold - currentThreshold) * 100));
  return { xp, skills, currentIndex, nextThreshold, progress };
}

export function appendShopRunLog(log: ShopRunLogEntry[], entry: ShopRunLogEntry, limit = 24) {
  return [entry, ...log].slice(0, Math.max(1, limit));
}

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function finiteNumber(value: unknown, fallback: number) { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }

function migrateBests(value: unknown): ManualSaveData["bests"] {
  const bests: ManualSaveData["bests"] = {};
  if (!isRecord(value)) return bests;
  for (const id of ["drive", "rib", "bracket"] as ManualContractId[]) {
    const source = value[id];
    if (!isRecord(source)) continue;
    bests[id] = {
      score: finiteNumber(source.score, 0),
      precision: finiteNumber(source.precision, 0),
      completion: finiteNumber(source.completion, 0),
      elapsed: finiteNumber(source.elapsed, 0),
      geometry: typeof source.geometry === "number" ? source.geometry : undefined,
      finish: typeof source.finish === "number" ? source.finish : undefined,
      time: typeof source.time === "number" ? source.time : undefined,
    };
  }
  return bests;
}

function migrateLog(value: unknown): ShopRunLogEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((entry) => ({
    id: String(entry.id ?? ""),
    contract: (entry.contract === "drive" || entry.contract === "rib" || entry.contract === "bracket") ? entry.contract : "drive",
    program: String(entry.program ?? ""),
    title: String(entry.title ?? ""),
    score: finiteNumber(entry.score, 0),
    rank: String(entry.rank ?? "C"),
    accepted: Boolean(entry.accepted),
    completion: finiteNumber(entry.completion, 0),
    precision: finiteNumber(entry.precision, 0),
    finish: finiteNumber(entry.finish, 0),
    elapsed: finiteNumber(entry.elapsed, 0),
    overcut: finiteNumber(entry.overcut, 0),
    at: finiteNumber(entry.at, 0),
  })).filter((entry) => entry.id);
}

export function migrateManualSave(value: unknown): ManualSaveData {
  if (!isRecord(value)) return { ...DEFAULT_MANUAL_SAVE, cleared: [], mastery: {}, bests: {}, log: [] };
  const cleared = Array.isArray(value.cleared) ? value.cleared.filter((id): id is ManualContractId => id === "drive" || id === "rib" || id === "bracket") : [];
  const mastery: ManualSaveData["mastery"] = {};
  if (isRecord(value.mastery)) for (const id of ["drive", "rib", "bracket"] as ManualContractId[]) {
    const source = value.mastery[id];
    if (!isRecord(source)) continue;
    const bestRank = ["S", "A", "B", "C", "REWORK"].includes(String(source.bestRank)) ? source.bestRank as ManualGrade["rank"] : "REWORK";
    mastery[id] = { attempts: Math.max(0, Math.floor(finiteNumber(source.attempts, 0))), bestScore: Math.max(0, Math.min(100, finiteNumber(source.bestScore, 0))), bestRank, accepted: Boolean(source.accepted) };
  }
  for (const id of cleared) mastery[id] ??= { attempts: 1, bestScore: 0, bestRank: "C", accepted: true };
  return {
    version: 3,
    credits: Math.max(0, Math.floor(finiteNumber(value.credits, DEFAULT_MANUAL_SAVE.credits))),
    reputation: Math.max(0, Math.floor(finiteNumber(value.reputation, 0))),
    cleared: [...new Set(cleared)],
    totalAttempts: Math.max(0, Math.floor(finiteNumber(value.totalAttempts, Object.values(mastery).reduce((sum, item) => sum + (item?.attempts ?? 0), 0)))),
    mastery,
    bests: migrateBests(value.bests),
    log: migrateLog(value.log),
  };
}

const RANK_ORDER: Record<ManualGrade["rank"], number> = { REWORK: 0, C: 1, B: 2, A: 3, S: 4 };

export function recordManualAttempt(save: ManualSaveData, contract: ManualContract, grade: ManualGrade) {
  const current = save.mastery[contract.id] ?? { attempts: 0, bestScore: 0, bestRank: "REWORK" as const, accepted: false };
  const firstClear = grade.accepted && !save.cleared.includes(contract.id);
  const improved = grade.score > current.bestScore;
  const bestRank = RANK_ORDER[grade.rank] > RANK_ORDER[current.bestRank] ? grade.rank : current.bestRank;
  const next: ManualSaveData = {
    version: 3,
    credits: save.credits + (grade.accepted ? firstClear ? grade.payout : Math.round(grade.payout * .2) : 0),
    reputation: save.reputation + (grade.accepted && (firstClear || improved) ? Math.max(1, grade.score - current.bestScore) : 0),
    cleared: firstClear ? [...save.cleared, contract.id] : [...save.cleared],
    totalAttempts: save.totalAttempts + 1,
    mastery: { ...save.mastery, [contract.id]: { attempts: current.attempts + 1, bestScore: Math.max(current.bestScore, grade.score), bestRank, accepted: current.accepted || grade.accepted } },
    bests: save.bests,
    log: save.log,
  };
  return next;
}
