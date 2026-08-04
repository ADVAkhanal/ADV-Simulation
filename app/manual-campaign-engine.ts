export const MILL_COLS = 28;
export const MILL_ROWS = 16;
export const MILL_CELLS = MILL_COLS * MILL_ROWS;

export type ManualContract = {
  id: "drive" | "rib" | "bracket";
  program: string;
  client: string;
  title: string;
  brief: string;
  material: string;
  reward: number;
  par: number;
  tolerance: number;
  color: string;
};

export type MillTool = { id: number; name: string; diameter: string; radius: number; load: number; wear: number; finish: number; role: string };
export type ShopBestRun = { score: number; precision: number; completion: number; elapsed: number; geometry?: number; finish?: number; time?: number };
export type ShopRunLogEntry = { id: string; contract: ManualContract["id"]; program: string; title: string; score: number; rank: string; accepted: boolean; completion: number; precision: number; finish: number; elapsed: number; overcut: number; at: number };

export const MANUAL_CONTRACTS: ManualContract[] = [
  { id: "drive", program: "NS-0142-A", client: "NORTHSTAR MOBILITY", title: "Emergency drive plate", brief: "Profile the drivetrain interface before the sunrise rig test.", material: "6061 AL", reward: 1700, par: 75, tolerance: 3, color: "#50e6ff" },
  { id: "rib", program: "KS-2207-R", client: "KESTREL AEROSPACE", title: "Flight rib prototype", brief: "Release a lightweight rib while preserving the load path and three lightening webs.", material: "7075-T6", reward: 2450, par: 92, tolerance: 2, color: "#d8ff3e" },
  { id: "bracket", program: "OR-771-C", client: "ORBITAL RESEARCH", title: "Sensor bracket", brief: "Cut the asymmetric optical bracket with zero damage around its datum bosses.", material: "Ti-6Al-4V", reward: 3200, par: 110, tolerance: 1, color: "#ff6ea9" },
];

export const MILL_TOOLS: MillTool[] = [
  { id: 1, name: "FINISHER", diameter: "6 MM", radius: .78, load: .62, wear: .7, finish: .35, role: "Precision edges" },
  { id: 2, name: "ROUGHER", diameter: "12 MM", radius: 1.35, load: 1, wear: 1, finish: .8, role: "Balanced removal" },
  { id: 3, name: "HOG MILL", diameter: "20 MM", radius: 2.1, load: 1.48, wear: 1.55, finish: 1.5, role: "Fast, high risk" },
];

export function isManualTarget(contract: ManualContract["id"], col: number, row: number) {
  const x = col - (MILL_COLS - 1) / 2;
  const y = row - (MILL_ROWS - 1) / 2;
  if (contract === "drive") {
    const outer = Math.abs(x) <= 9.7 && Math.abs(y) <= 5.3 && Math.abs(x) + Math.abs(y) <= 13.2;
    const center = Math.hypot(x, y) < 2.5;
    const bolts = [[-6,-3.2],[6,-3.2],[-6,3.2],[6,3.2]].some(([bx,by]) => Math.hypot(x-bx,y-by) < 1);
    return outer && !center && !bolts;
  }
  if (contract === "rib") {
    const span = Math.abs(x) <= 11.5;
    const envelope = span && Math.abs(y) <= 2.3 + (1 - Math.abs(x) / 12) * 2.8;
    const lightening = [-6,0,6].some((cx) => Math.hypot((x-cx)/2.1,y/1.65) < 1);
    return envelope && !lightening;
  }
  const vertical = x >= -9 && x <= -4 && y >= -5.5 && y <= 5.5;
  const base = x >= -9 && x <= 8.5 && y >= 1 && y <= 5.5;
  const boss = Math.hypot(x-5.7,y-1.1) < 3.1;
  const bore = Math.hypot(x-5.7,y-1.1) < 1.35;
  const datum = Math.hypot(x+6.4,y-2.8) < 1.1;
  return (vertical || base || boss) && !bore && !datum;
}

export function createManualStock() { return new Uint8Array(MILL_CELLS).fill(1); }

export function cutManualStock(source: Uint8Array, contract: ManualContract["id"], cutterX: number, cutterY: number, radius: number) {
  const material = source.slice();
  let correct = 0; let overcut = 0; let engagement = 0;
  for (let row = 0; row < MILL_ROWS; row += 1) for (let col = 0; col < MILL_COLS; col += 1) {
    const index = row * MILL_COLS + col;
    if (!material[index] || Math.hypot(col-cutterX,row-cutterY) > radius) continue;
    material[index] = 0; engagement += 1;
    if (isManualTarget(contract,col,row)) overcut += 1; else correct += 1;
  }
  return { material, correct, overcut, engagement };
}

export function manualCompletion(material: Uint8Array, contract: ManualContract["id"]) {
  let removed = 0; let required = 0;
  for (let index=0; index<MILL_CELLS; index+=1) {
    const col=index%MILL_COLS; const row=Math.floor(index/MILL_COLS);
    if (!isManualTarget(contract,col,row)) { required+=1; if (!material[index]) removed+=1; }
  }
  return Math.min(100,Math.round(removed/Math.max(1,required)*100));
}

export function gradeManualRun(material: Uint8Array, contract: ManualContract, overcut: number, finishPenalty: number, elapsed: number, breaks: number) {
  const completion=manualCompletion(material,contract.id);
  const geometry=Math.min(46,completion/90*46);
  const precision=Math.max(0,30-overcut*(contract.id==="bracket"?5:3.2));
  const finish=Math.max(0,14-finishPenalty*1.3);
  const time=Math.max(0,10-Math.max(0,elapsed-contract.par)*.1);
  const score=Math.max(0,Math.min(100,Math.round(geometry+precision+finish+time-breaks*5)));
  const accepted=completion>=90&&overcut<=contract.tolerance;
  const rank=!accepted?"REWORK":score>=96?"S":score>=88?"A":score>=76?"B":"C";
  return {completion,geometry:Math.round(geometry),precision:Math.round(precision),finish:Math.round(finish),time:Math.round(time),breakPenalty:breaks*5,score,accepted,rank,payout:accepted?Math.round(contract.reward*(.55+score/220)):120};
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
