export const GRID_COLS = 24;
export const GRID_ROWS = 14;
export const CELL_COUNT = GRID_COLS * GRID_ROWS;

export type CutResult = {
  material: Uint8Array;
  correct: number;
  overcut: number;
  engagement: number;
};

export type InspectionInput = {
  material: Uint8Array;
  overcut: number;
  finishPenalty: number;
  elapsedSeconds: number;
  toolBreaks: number;
};

export type InspectionResult = {
  accepted: boolean;
  score: number;
  grade: "S" | "A" | "B" | "C" | "F";
  completion: number;
  precision: number;
  finish: number;
  time: number;
  payout: number;
};

const holes = [
  [7, 4],
  [16, 4],
  [7, 9],
  [16, 9],
];

export function isTargetCell(col: number, row: number): boolean {
  const cx = 11.5;
  const cy = 6.5;
  const dx = Math.abs(col - cx);
  const dy = Math.abs(row - cy);
  const outer = dx <= 8 && dy <= 5 && dx + dy <= 11.25;
  if (!outer) return false;

  const centerHole = Math.hypot(col - cx, row - cy) < 2.35;
  const boltHole = holes.some(([x, y]) => Math.hypot(col - x, row - y) < 0.82);
  return !centerHole && !boltHole;
}

export const REQUIRED_REMOVALS = Array.from({ length: CELL_COUNT }, (_, index) => {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  return isTargetCell(col, row) ? 0 : 1;
}).reduce((sum, value) => sum + value, 0);

export function createStock(): Uint8Array {
  return new Uint8Array(CELL_COUNT).fill(1);
}

export function cutStock(source: Uint8Array, cutterCol: number, cutterRow: number, radius = 1.18): CutResult {
  const material = source.slice();
  let correct = 0;
  let overcut = 0;
  let engagement = 0;

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      const index = row * GRID_COLS + col;
      if (!material[index]) continue;
      if (Math.hypot(col - cutterCol, row - cutterRow) > radius) continue;
      material[index] = 0;
      engagement += 1;
      if (isTargetCell(col, row)) overcut += 1;
      else correct += 1;
    }
  }

  return { material, correct, overcut, engagement };
}

export function completionFor(material: Uint8Array): number {
  let removed = 0;
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (!material[index]) {
      const col = index % GRID_COLS;
      const row = Math.floor(index / GRID_COLS);
      if (!isTargetCell(col, row)) removed += 1;
    }
  }
  return Math.min(100, Math.round((removed / REQUIRED_REMOVALS) * 100));
}

export function inspectPart(input: InspectionInput): InspectionResult {
  const completion = completionFor(input.material);
  const completionPoints = Math.min(45, (completion / 88) * 45);
  const precision = Math.max(0, 30 - input.overcut * 2.8);
  const finish = Math.max(0, 15 - input.finishPenalty * 1.25);
  const time = Math.max(0, 10 - Math.max(0, input.elapsedSeconds - 55) * 0.08);
  const breakPenalty = input.toolBreaks * 4;
  const score = Math.max(0, Math.min(100, Math.round(completionPoints + precision + finish + time - breakPenalty)));
  const accepted = completion >= 88 && input.overcut <= 3;
  const grade = !accepted ? "F" : score >= 95 ? "S" : score >= 86 ? "A" : score >= 74 ? "B" : "C";
  const payout = accepted ? Math.round(850 + score * 8.5) : 80;
  return { accepted, score, grade, completion, precision: Math.round(precision), finish: Math.round(finish), time: Math.round(time), payout };
}
