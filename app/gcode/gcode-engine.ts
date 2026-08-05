export type MotionKind = "rapid" | "feed-line" | "arc-cw" | "arc-ccw";

export type Vec3 = { x: number; y: number; z: number };

export type CanonicalMotion = {
  kind: MotionKind;
  start: Vec3;
  target: Vec3;
  center?: { x: number; y: number };
  feed: number;
  sourceLine: number;
  spindleEnabled: boolean;
  coolantEnabled: boolean;
  tool: number;
};

export type ToolPoint = Vec3 & {
  cut: boolean;
  line: number;
  feed: number;
};

export type ProgramDiagnostic = {
  category: "unsupported-command" | "missing-axis" | "invalid-arc" | "unsafe-state" | "travel-limit" | "collision";
  line: number;
  message: string;
};

export type ParsedProgram = {
  canonical: CanonicalMotion[];
  points: ToolPoint[];
  diagnostics: ProgramDiagnostic[];
  errors: string[];
  state: { units: "mm" | "inch"; absolute: boolean; spindle: boolean; coolant: boolean; tool: number };
};

export type MissionGrade = {
  coverage: number;
  precision: number;
  waste: number;
  cycleSeconds: number;
  score: number;
  rank: "S" | "A" | "B" | "C" | "REWORK";
};

export type MachiningSetup = {
  compensation: "center" | "left" | "right";
  finalDepth: number;
  path: "as-programmed" | "climb" | "conventional";
  passes: number;
  reverse: boolean;
};

export type OperationGroup = {
  id: string;
  label: string;
  kind: "setup" | "cut" | "exit";
  pass: number | null;
  startFrame: number;
  endFrame: number;
  sourceLines: number[];
};

export type MachiningPlan = {
  points: ToolPoint[];
  groups: OperationGroup[];
  direction: "FORWARD" | "REVERSE";
  compensationMm: number;
  passDepths: number[];
};

const COLS = 46;
const ROWS = 25;
const RAPID_FEED = 3000;
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function signedArea(points: ToolPoint[]) {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

function offsetPath(points: ToolPoint[], offset: number) {
  if (!offset || points.length < 2) return points.map((point) => ({ ...point }));
  return points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)], next = points[Math.min(points.length - 1, index + 1)];
    const dx = next.x - previous.x, dy = next.y - previous.y, length = Math.hypot(dx, dy) || 1;
    return { ...point, x: point.x + (-dy / length) * offset, y: point.y + (dx / length) * offset };
  });
}

export function buildMachiningPlan(program: ParsedProgram, setup: MachiningSetup): MachiningPlan {
  const points = program.points;
  const firstCut = points.findIndex((point) => point.cut);
  let lastCut = -1;
  for (let index = points.length - 1; index >= 0; index -= 1) if (points[index].cut) { lastCut = index; break; }
  if (firstCut < 0 || lastCut < firstCut) return { points: points.map((point) => ({ ...point })), groups: [{ id: "setup", label: "SETUP / NO CUT", kind: "setup", pass: null, startFrame: 1, endFrame: points.length, sourceLines: [...new Set(points.map((point) => point.line))] }], direction: setup.reverse ? "REVERSE" : "FORWARD", compensationMm: 0, passDepths: [] };

  const setupPoints = points.slice(0, firstCut).map((point) => ({ ...point }));
  const cuttingPoints = points.slice(firstCut, lastCut + 1).filter((point) => point.cut);
  const exitPoints = points.slice(lastCut + 1).map((point) => ({ ...point }));
  const area = signedArea(cuttingPoints);
  const strategyReverse = setup.path === "climb" ? area > 0 : setup.path === "conventional" ? area < 0 : false;
  const reverse = strategyReverse !== setup.reverse;
  const ordered = reverse ? [...cuttingPoints].reverse() : cuttingPoints;
  const compensationMm = setup.compensation === "left" ? .6 : setup.compensation === "right" ? -.6 : 0;
  const compensated = offsetPath(ordered, compensationMm);
  const passCount = clamp(Math.round(setup.passes), 1, 6);
  const finalDepth = clamp(setup.finalDepth, -6, -.2);
  const passDepths = Array.from({ length: passCount }, (_, index) => Number((finalDepth * ((index + 1) / passCount)).toFixed(2)));
  const planned: ToolPoint[] = [...setupPoints];
  const groups: OperationGroup[] = [];
  if (setupPoints.length) groups.push({ id: "setup", label: "SETUP / APPROACH", kind: "setup", pass: null, startFrame: 1, endFrame: setupPoints.length, sourceLines: [...new Set(setupPoints.map((point) => point.line))] });
  passDepths.forEach((depth, passIndex) => {
    const startFrame = planned.length + 1;
    const first = compensated[0];
    planned.push({ ...first, z: Math.max(.8, Math.abs(depth) * .35), cut: false });
    compensated.forEach((point) => planned.push({ ...point, z: depth, cut: true }));
    planned.push({ ...compensated.at(-1)!, z: Math.max(.8, Math.abs(depth) * .35), cut: false });
    groups.push({ id: `pass-${passIndex + 1}`, label: `${passIndex + 1 === passCount ? "FINISH" : "ROUGH"} / PASS ${passIndex + 1}`, kind: "cut", pass: passIndex + 1, startFrame, endFrame: planned.length, sourceLines: [...new Set(compensated.map((point) => point.line))] });
  });
  const exitStart = planned.length + 1;
  planned.push(...exitPoints);
  if (exitPoints.length) groups.push({ id: "exit", label: "EXIT / SAFE Z", kind: "exit", pass: null, startFrame: exitStart, endFrame: planned.length, sourceLines: [...new Set(exitPoints.map((point) => point.line))] });
  return { points: planned, groups, direction: reverse ? "REVERSE" : "FORWARD", compensationMm, passDepths };
}

function wordsFor(line: string) {
  const words = new Map<string, number>();
  for (const match of line.matchAll(/([A-Z])\s*(-?\d+(?:\.\d+)?)/g)) words.set(match[1], Number(match[2]));
  return words;
}

function interpolateLine(from: ToolPoint, to: Vec3, line: number, cut: boolean, feed: number) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  const steps = Math.max(1, Math.ceil(distance * 2));
  return Array.from({ length: steps }, (_, index) => {
    const t = (index + 1) / steps;
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t, cut, line, feed };
  });
}

function interpolateArc(from: ToolPoint, to: Vec3, center: { x: number; y: number }, clockwise: boolean, line: number, cut: boolean, feed: number) {
  const radius = Math.hypot(from.x - center.x, from.y - center.y);
  let startAngle = Math.atan2(from.y - center.y, from.x - center.x);
  let endAngle = Math.atan2(to.y - center.y, to.x - center.x);
  if (clockwise && endAngle >= startAngle) endAngle -= Math.PI * 2;
  if (!clockwise && endAngle <= startAngle) endAngle += Math.PI * 2;
  const sweep = endAngle - startAngle;
  const steps = Math.max(8, Math.ceil(Math.abs(sweep) * radius * 2));
  return Array.from({ length: steps }, (_, index) => {
    const t = (index + 1) / steps;
    const angle = startAngle + sweep * t;
    return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius, z: from.z + (to.z - from.z) * t, cut, line, feed };
  });
}

export function parseProgram(source: string): ParsedProgram {
  const points: ToolPoint[] = [{ x: 0, y: 0, z: 5, cut: false, line: 0, feed: 0 }];
  const canonical: CanonicalMotion[] = [];
  const diagnostics: ProgramDiagnostic[] = [];
  let position = points[0];
  let absolute = true;
  let spindle = false;
  let coolant = false;
  let units: "mm" | "inch" = "mm";
  let feed = 300;
  let tool = 1;

  source.split("\n").forEach((raw, index) => {
    const lineNumber = index + 1;
    const clean = raw.replace(/\([^)]*\)/g, "").split(";")[0].trim().toUpperCase();
    if (!clean) return;
    const words = wordsFor(clean);
    const gCodes = [...clean.matchAll(/\bG0*(\d+)\b/g)].map((match) => Number(match[1]));
    const mCodes = [...clean.matchAll(/\bM0*(\d+)\b/g)].map((match) => Number(match[1]));
    for (const code of gCodes) {
      if (![0, 1, 2, 3, 20, 21, 90, 91].includes(code)) diagnostics.push({ category: "unsupported-command", line: lineNumber, message: `G${code} is outside this creative controller` });
    }
    if (gCodes.includes(20)) units = "inch";
    if (gCodes.includes(21)) units = "mm";
    if (gCodes.includes(90)) absolute = true;
    if (gCodes.includes(91)) absolute = false;
    if (mCodes.includes(3) || mCodes.includes(4)) spindle = true;
    if (mCodes.includes(5)) spindle = false;
    if (mCodes.includes(8)) coolant = true;
    if (mCodes.includes(9)) coolant = false;
    if (words.has("T")) tool = clamp(Math.round(words.get("T")!), 1, 12);
    const unitScale = units === "inch" ? 25.4 : 1;
    if (words.has("F")) feed = clamp(words.get("F")! * unitScale, 20, 2400);
    const motionCode = gCodes.find((code) => [0, 1, 2, 3].includes(code));
    if (motionCode === undefined) return;
    if (!["X", "Y", "Z"].some((axis) => words.has(axis))) {
      diagnostics.push({ category: "missing-axis", line: lineNumber, message: "motion needs X, Y, or Z" });
      return;
    }
    const axis = (key: "X" | "Y" | "Z", current: number) => words.has(key) ? (absolute ? words.get(key)! * unitScale : current + words.get(key)! * unitScale) : current;
    const target = { x: axis("X", position.x), y: axis("Y", position.y), z: axis("Z", position.z) };
    if (target.x < -2 || target.x > 42 || target.y < -2 || target.y > 40 || target.z < -6 || target.z > 12) {
      diagnostics.push({ category: "travel-limit", line: lineNumber, message: "target leaves the lesson envelope" });
    }
    const cutting = motionCode !== 0 && target.z < 0 && spindle;
    if (motionCode !== 0 && target.z < 0 && !spindle) diagnostics.push({ category: "unsafe-state", line: lineNumber, message: "feed below stock with spindle stopped" });
    // Rapids (G00) travel at full non-cutting speed with no engagement control.
    // A real controller never programs one below the stock surface - that is
    // a tool crash, not a slow feed, regardless of spindle or prior material state.
    if (motionCode === 0 && target.z < 0) diagnostics.push({ category: "collision", line: lineNumber, message: "rapid move targets Z below the stock - this crashes the tool" });
    const kind: MotionKind = motionCode === 0 ? "rapid" : motionCode === 1 ? "feed-line" : motionCode === 2 ? "arc-cw" : "arc-ccw";
    let center: { x: number; y: number } | undefined;
    if (motionCode === 2 || motionCode === 3) {
      if (!words.has("I") && !words.has("J")) {
        diagnostics.push({ category: "invalid-arc", line: lineNumber, message: "arc needs I or J center offset" });
        return;
      }
      center = { x: position.x + (words.get("I") ?? 0) * unitScale, y: position.y + (words.get("J") ?? 0) * unitScale };
      const startRadius = Math.hypot(position.x - center.x, position.y - center.y);
      const endRadius = Math.hypot(target.x - center.x, target.y - center.y);
      if (Math.abs(startRadius - endRadius) > 0.35) diagnostics.push({ category: "invalid-arc", line: lineNumber, message: "arc endpoint misses its radius" });
    }
    canonical.push({ kind, start: { x: position.x, y: position.y, z: position.z }, target, center, feed, sourceLine: lineNumber, spindleEnabled: spindle, coolantEnabled: coolant, tool });
    const generated = center ? interpolateArc(position, target, center, motionCode === 2, lineNumber, cutting, feed) : interpolateLine(position, target, lineNumber, cutting, feed);
    points.push(...generated);
    position = generated.at(-1) ?? { ...target, cut: cutting, line: lineNumber, feed };
  });

  return { canonical, points, diagnostics, errors: diagnostics.map((item) => `L${item.line}: ${item.message}`), state: { units, absolute, spindle, coolant, tool } };
}

function cellKey(point: ToolPoint) {
  return `${clamp(Math.round(point.x), 0, 40)},${clamp(Math.round(point.y * 0.6), 0, 22)}`;
}

function cutMask(points: ToolPoint[], frame = points.length) {
  const mask = new Set<string>();
  points.slice(0, frame).filter((point) => point.cut && point.z < 0).forEach((point) => {
    const [x, y] = cellKey(point).split(",").map(Number);
    const radius = point.z <= -2.4 ? 2 : 1;
    for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) if (dx * dx + dy * dy <= radius * radius) mask.add(`${clamp(x + dx, 0, 40)},${clamp(y + dy, 0, 22)}`);
  });
  return mask;
}

export function estimateCycleSeconds(program: ParsedProgram) {
  return program.canonical.reduce((total, motion) => {
    const distance = Math.hypot(motion.target.x - motion.start.x, motion.target.y - motion.start.y, motion.target.z - motion.start.z);
    return total + distance / (motion.kind === "rapid" ? RAPID_FEED : Math.max(20, motion.feed)) * 60;
  }, 0);
}

export function gradeMission(program: ParsedProgram, target: ParsedProgram): MissionGrade {
  const actual = cutMask(program.points);
  const expected = cutMask(target.points);
  let hits = 0;
  actual.forEach((cell) => { if (expected.has(cell)) hits += 1; });
  const extras = Math.max(0, actual.size - hits);
  const coverage = Math.round((hits / Math.max(1, expected.size)) * 100);
  const precision = Math.round((hits / Math.max(1, actual.size)) * 100);
  const waste = Math.round((extras / Math.max(1, expected.size)) * 100);
  const cycleSeconds = estimateCycleSeconds(program);
  const diagnosticPenalty = program.errors.length * 12;
  const score = clamp(Math.round(coverage * 5 + precision * 4 + Math.max(0, 100 - waste) - diagnosticPenalty), 0, 1000);
  const rank = score >= 930 ? "S" : score >= 840 ? "A" : score >= 720 ? "B" : score >= 580 ? "C" : "REWORK";
  return { coverage, precision, waste, cycleSeconds, score, rank };
}

export function rasterize(points: ToolPoint[], frame: number) {
  const visible = points.slice(0, Math.max(1, frame));
  const removed = cutMask(points, frame);
  const grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => "#"));
  for (let row = 0; row < ROWS; row += 1) { grid[row][0] = "|"; grid[row][COLS - 1] = "|"; }
  for (let col = 0; col < COLS; col += 1) { grid[0][col] = "-"; grid[ROWS - 1][col] = "-"; }
  grid[0][0] = "+"; grid[0][COLS - 1] = "+"; grid[ROWS - 1][0] = "+"; grid[ROWS - 1][COLS - 1] = "+";
  removed.forEach((key) => {
    const [x, y] = key.split(",").map(Number);
    grid[ROWS - 2 - y][2 + x] = " ";
  });
  visible.filter((point) => !point.cut).forEach((point, index) => {
    const col = clamp(2 + Math.round(point.x), 1, COLS - 2);
    const row = clamp(ROWS - 2 - Math.round(point.y * 0.6), 1, ROWS - 2);
    if (grid[row][col] === "#" && index % 2 === 0) grid[row][col] = ":";
  });
  const head = visible.at(-1);
  if (head) grid[clamp(ROWS - 2 - Math.round(head.y * 0.6), 1, ROWS - 2)][clamp(2 + Math.round(head.x), 1, COLS - 2)] = "@";
  return grid.map((row) => row.join("")).join("\n");
}
