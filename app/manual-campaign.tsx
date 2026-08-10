"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, stagger } from "animejs";
import { Activity, Award, BookOpen, CircleGauge, CircleHelp, Crosshair, Factory, Gamepad2, Gauge, Hexagon, LockKeyhole, Pause, Play, RotateCcw, ScanLine, Share2, ShieldCheck, Sparkles, Target, Volume2, VolumeX, Waves, Wrench, X, Zap } from "lucide-react";
import {
  DEFAULT_MANUAL_SAVE,
  MANUAL_CONTRACTS,
  MILL_COLS,
  MILL_ROWS,
  MILL_TOOLS,
  allManualOperationsComplete,
  appendShopRunLog,
  buildManualMeasurements,
  createManualFinishMap,
  createManualStock,
  deriveFlowPoints,
  deriveManualMission,
  deriveMasteryRank,
  deriveShopSkillProgress,
  evaluateManualDisposition,
  gradeManualRun,
  isManualBoundary,
  isManualTarget,
  machineManualStock,
  manualCompletion,
  manualOperationProgress,
  migrateManualSave,
  recommendedManualDisposition,
  recordManualAttempt,
  type InspectionDisposition,
  type InspectionInstrumentId,
  type ManualContract,
  type ManualGrade,
  type ManualMeasurement,
  type ManualOperationId,
  type ManualSaveData,
  type ShopRunLogEntry,
} from "./manual-campaign-engine";
import { trackAnonymous } from "./anonymous-analytics";
import FlagshipMachiningKit from "./flagship-machining-kit";
import { shareResultCard } from "./result-card";
import baseStyles from "./manual-campaign.module.css";
import retentionStyles from "./manual-campaign-retention.module.css";
import rapidStyles from "./rapid-action.module.css";

const styles = { ...baseStyles, ...retentionStyles };

type Screen = "select" | "play" | "inspection" | "result";
type LearningLevel = "easy" | "medium" | "hard";
type RunResult = ManualGrade & { disposition: InspectionDisposition };
type Chip = { x: number; y: number; dx: number; dy: number; born: number; hot: boolean };
type GameEvent = { id: number; kind: "objective" | "warning" | "reward"; title: string; detail: string };
const SAVE_KEY = "toolpath-manual-campaign-v3";
const LEGACY_SAVE_KEY = "toolpath-manual-campaign-v2";
const SWAP_TOOL_COST = 45;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const STOCK_VIEW = { x: 80, y: 52, width: 960, height: 560 }; // 240 × 140 mm at an exact 4 px/mm drawing scale.
const LEARNING_LENSES = {
  easy: { label: "Easy", eyebrow: "First Cut", title: "Keep the shape. Clear the space.", summary: "The glowing shape is the part you are saving. Silver is extra material. Start the spindle, drag through silver, and stop before the cutter touches the glow.", concepts: [["CUTTER", "The circle under your pointer removes material."], ["LOAD", "Green is comfortable. Red means pause and take a smaller bite."], ["WIN", "Sign off every operation, then prove quality in the inspection bay."]], play: "Silver goes. Glow stays. Use the smaller cutter near the edge." },
  medium: { label: "Medium", eyebrow: "Apprentice View", title: "Control engagement, not just motion.", summary: "Cutter size and radial engagement determine how much material each move removes. Open areas reward a rougher; tight profiles reward a smaller finishing tool. Each operation only accepts tools rated for it.", concepts: [["ENGAGEMENT", "The amber arc shows how much of the cutter is buried in stock."], ["PROCESS", "Higher engagement raises simulated spindle load, heat, and finish risk."], ["SEQUENCE", "Sign off profile, pocket, or drill work before the finishing pass is available."]], play: "Watch the amber engagement arc. Reduce tool size or feed near constrained geometry." },
  hard: { label: "Hard", eyebrow: "Engineering View", title: "Read the process window.", summary: "The simulation links feed, spindle speed, flute count, radial engagement, finish, and instrument-gated inspection into one consistent system. Values are fictional training data—not machine parameters.", concepts: [["CHIP LOAD", "The display derives fz = F ÷ (S × 3 flutes) from the simulated feed and RPM."], ["FORCE", "The amber Ft vector is tangential to cutter travel; its length follows simulated load."], ["INSPECTION", "Disposition must match the measured evidence, not a guess, before credits release."]], play: "Balance fz, ae, load, and Ra. Preserve profile first; optimize cycle only inside the quality window." },
} as const;
const ROLE_LADDER = [
  { threshold: 0, level: "L0", role: "SHOP FOUNDATIONS", code: "ORIENTATION", focus: "Datum awareness · material removal · inspection loop", evidence: "Complete a measured run" },
  { threshold: 70, level: "L1", role: "CNC OPERATOR ALIGNMENT", code: "O*NET 51-9161.00", focus: "Monitor process · protect workholding · inspect output", evidence: "70 best-run XP" },
  { threshold: 165, level: "L2", role: "MACHINIST / SETUP ALIGNMENT", code: "O*NET 51-4041.00", focus: "Read geometry · select tooling · control tolerance", evidence: "165 best-run XP" },
  { threshold: 250, level: "L3", role: "CNC PROGRAMMER ALIGNMENT", code: "O*NET 51-9162.00", focus: "Plan sequence · define paths · verify simulation", evidence: "250 best-run XP" },
] as const;
const CONTRACT_VISUALS = {
  drive: { artifact: "DRIVE INTERFACE", route: "PROFILE + BORE", stock: "PLATE / 18 MM", finish: "MILL / BRUSH", image: "/assets/2d/contracts/emergency-drive-plate-v1.webp" },
  rib: { artifact: "LIGHTWEIGHT RIB", route: "WEBS + CONTOUR", stock: "PLATE / 22 MM", finish: "MILL / BLEND", image: "/assets/2d/contracts/orbital-structural-rib-v1.webp" },
  bracket: { artifact: "OPTICAL BRACKET", route: "BOSS + DATUM", stock: "BLOCK / 32 MM", finish: "MILL / SATIN", image: "/assets/2d/contracts/sensor-bracket-v1.webp" },
} as const;
const TOUR_STEPS = [
  { code: "01", eyebrow: "NAVIGATION", title: "Three surfaces. One shop.", body: "Use the bottom dock to move between hands-on milling, G-code programming, and the 3D asset lab. Your current mode is always highlighted." },
  { code: "02", eyebrow: "CONTRACT", title: "Read the job before the cut.", body: "The contract bar names the material, program, active operation, par time, and tolerance. Return to the contract index whenever you want a different geometry." },
  { code: "03", eyebrow: "PROCESS SETUP", title: "Plan the sequence, then the risk.", body: "Every contract runs profile, pocket, drill, and finish work in order. Tool diameter and feed override change removal speed, engagement, finish, and overcut risk — but only a tool rated for the active operation can cut." },
  { code: "04", eyebrow: "INTERACTIVE 3D", title: "Orbit the physical setup.", body: "The 3D Twin is now a movable assembly. Drag to orbit, use the wheel to zoom, pause automatic rotation, or reset the camera." },
  { code: "05", eyebrow: "LIVE TELEMETRY", title: "Read the process window.", body: "Load, heat, tool condition, chip load, engagement, and tool fit stay separate so one attractive number cannot hide a damaged process or a locked-out tool." },
  { code: "06", eyebrow: "INSPECTION LOOP", title: "Measure, disposition, retry.", body: "Sign off every operation, then measure each characteristic with the correct instrument in the inspection bay. Accept, rework, or scrap — an unsupported disposition is blocked." },
] as const;

function deriveShopProgress(save: ManualSaveData) {
  const base = deriveShopSkillProgress(save.bests, ROLE_LADDER.map((role) => role.threshold));
  return { ...base, current: ROLE_LADDER[base.currentIndex], next: ROLE_LADDER[base.currentIndex + 1] ?? null };
}

export default function ManualCampaign() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cycleButtonRef = useRef<HTMLButtonElement>(null);
  const dragging = useRef(false);
  const firstCutTracked = useRef(false);
  const retryStartedAt = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);
  const lastCutTone = useRef(0);
  const chipsRef = useRef<Chip[]>([]);
  const toolpathRef = useRef<Array<{ x: number; y: number }>>([]);
  const materialRef = useRef(createManualStock());
  const finishedRef = useRef(createManualFinishMap());
  const milestoneRef = useRef(new Set<number>());
  const eventTimerRef = useRef<number | null>(null);
  const lastComboCutRef = useRef(0);
  const comboRef = useRef(0);
  const [screen, setScreen] = useState<Screen>("select");
  const [contractIndex, setContractIndex] = useState(0);
  const [operationIndex, setOperationIndex] = useState(0);
  const [toolIndex, setToolIndex] = useState(1);
  const [material, setMaterial] = useState(createManualStock);
  const [finished, setFinished] = useState(createManualFinishMap);
  const [toolpath, setToolpath] = useState<Array<{ x: number; y: number }>>([]);
  const [spindle, setSpindle] = useState(false);
  const [feed, setFeed] = useState(55);
  const [heat, setHeat] = useState(20);
  const [condition, setCondition] = useState(100);
  const [load, setLoad] = useState(0);
  const [overcut, setOvercut] = useState(0);
  const [fixtureStrikes, setFixtureStrikes] = useState(0);
  const [finishPenalty, setFinishPenalty] = useState(0);
  const [breaks, setBreaks] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [cursor, setCursor] = useState({ x: 3, y: 3 });
  const [message, setMessage] = useState("Choose a contract. Geometry changes the process plan.");
  const [result, setResult] = useState<RunResult | null>(null);
  const [previousBest, setPreviousBest] = useState<ManualSaveData["bests"][ManualContract["id"]] | null>(null);
  const [save, setSave] = useState<ManualSaveData>(DEFAULT_MANUAL_SAVE);
  const [selectedCharacteristic, setSelectedCharacteristic] = useState("");
  const [instrument, setInstrument] = useState<InspectionInstrumentId>("touch-probe");
  const [measured, setMeasured] = useState<Record<string, ManualMeasurement>>({});
  const [inspectionMistakes, setInspectionMistakes] = useState(0);
  const [showCoach, setShowCoach] = useState(false);
  const [retryMs, setRetryMs] = useState<number | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [learningLevel, setLearningLevel] = useState<LearningLevel>("easy");
  const [logOpen, setLogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"map" | "twin">("map");
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [flowScore, setFlowScore] = useState(0);
  const [gameEvent, setGameEvent] = useState<GameEvent | null>(null);

  const contract = MANUAL_CONTRACTS[contractIndex];
  const operation = contract.operations[Math.min(operationIndex, contract.operations.length - 1)];
  const tool = MILL_TOOLS[toolIndex];
  const completion = useMemo(() => manualCompletion(material, contract.id), [contract.id, material]);
  const operationProgress = useMemo(() => manualOperationProgress(material, finished, contract.id, operation.id), [contract.id, finished, material, operation.id]);
  const operationsComplete = useMemo(() => allManualOperationsComplete(material, finished, contract), [contract, finished, material]);
  const readings = useMemo(() => buildManualMeasurements(material, finished, contract, overcut, finishPenalty, breaks), [breaks, contract, finishPenalty, finished, material, overcut]);
  const surfaceRa = clamp(.8 + finishPenalty * .42 + Math.max(0, feed - 85) * .025, .8, 12.5);
  const removalIndex = spindle ? Math.round(parseFloat(tool.diameter) * feed * Math.max(1, load) / 100) : 0;
  const machinePosition = { x: cursor.x / (MILL_COLS - 1) * 240, y: cursor.y / (MILL_ROWS - 1) * 140 };
  const spindleRpm = contract.material.includes("Ti") ? 2380 : contract.material.includes("7075") ? 6120 : 7480;
  const programmedFeed = Math.round((contract.material.includes("Ti") ? 310 : contract.material.includes("7075") ? 780 : 940) * feed / 100);
  const chipLoad = programmedFeed / Math.max(1, spindleRpm * 3);
  const engagementAngle = Math.round(clamp(load * 1.65, 0, 165));
  const shopProgress = deriveShopProgress(save);
  const mission = deriveManualMission(completion);
  const comboMultiplier = deriveFlowPoints(0, combo).multiplier;
  const toolCompatible = tool.operations.includes(operation.id);

  useEffect(() => {
    let migrated = DEFAULT_MANUAL_SAVE;
    try {
      const current = localStorage.getItem(SAVE_KEY);
      const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
      migrated = migrateManualSave(JSON.parse(current ?? legacy ?? "{}"));
      localStorage.setItem(SAVE_KEY, JSON.stringify(migrated));
    } catch { /* device progress is optional */ }
    const hydration = window.setTimeout(() => setSave(migrated), 0);
    trackAnonymous("landing_view", { surface: "manual_campaign" });
    return () => { window.clearTimeout(hydration); if (eventTimerRef.current !== null) window.clearTimeout(eventTimerRef.current); };
  }, []);

  useEffect(() => {
    if (screen !== "play" || !spindle || paused) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [screen, spindle, paused]);

  // Heat sheds fastest at safe Z (tool retracted, full coolant exposure) and
  // only trickles off while the spindle keeps spinning idle - feed hold is a
  // real cooldown lever, not just a pause.
  useEffect(() => {
    if (screen !== "play" || paused) return;
    const timer = window.setInterval(() => {
      setHeat((value) => clamp(value - (spindle ? 0.35 : 2.4), 18, 100));
      setLoad((value) => Math.max(0, value - 4));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen, spindle, paused]);

  useEffect(() => {
    if (!combo || screen !== "play") return;
    const decay = window.setInterval(() => {
      if (performance.now() - lastComboCutRef.current <= 1800) return;
      comboRef.current = Math.max(0, comboRef.current - 1);
      setCombo(comboRef.current);
    }, 450);
    return () => window.clearInterval(decay);
  }, [combo, screen]);

  useEffect(() => {
    if (tourStep === null) return;
    const closeTour = (event: KeyboardEvent) => { if (event.key === "Escape") setTourStep(null); };
    window.addEventListener("keydown", closeTour);
    return () => window.removeEventListener("keydown", closeTour);
  }, [tourStep]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const cw = STOCK_VIEW.width / MILL_COLS;
    const ch = STOCK_VIEW.height / MILL_ROWS;
    const sx = (value: number) => STOCK_VIEW.x + (value + .5) * cw;
    const sy = (value: number) => STOCK_VIEW.y + (value + .5) * ch;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    background.addColorStop(0, "#1a2529"); background.addColorStop(.48, "#081014"); background.addColorStop(1, "#020506");
    context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height);

    // VMC interior: enclosure seams, table, and T-slots establish real machine scale.
    context.strokeStyle = "#51656a28"; context.lineWidth = 1;
    for (let panel = 0; panel < 8; panel += 1) { const x = panel * 160 - 30; context.beginPath(); context.moveTo(x, 0); context.lineTo(x + 85, canvas.height); context.stroke(); }
    const table = context.createLinearGradient(0, 500, 0, 640); table.addColorStop(0, "#2c3a3e"); table.addColorStop(1, "#0d1518");
    context.fillStyle = table; context.fillRect(0, 535, canvas.width, 105);
    for (let slot = 0; slot < 9; slot += 1) { const x = 58 + slot * 126; context.fillStyle = "#05090b"; context.fillRect(x, 535, 15, 105); context.fillStyle = "#53666b42"; context.fillRect(x + 15, 535, 3, 105); }

    // Fixture jaws and parallels, dimensioned around the 240 × 140 mm stock envelope.
    const jaw = context.createLinearGradient(0, STOCK_VIEW.y, 0, STOCK_VIEW.y + STOCK_VIEW.height); jaw.addColorStop(0, "#6e7d80"); jaw.addColorStop(.12, "#263438"); jaw.addColorStop(1, "#111a1d");
    context.fillStyle = "#000b"; context.fillRect(STOCK_VIEW.x - 35, STOCK_VIEW.y + 11, STOCK_VIEW.width + 70, STOCK_VIEW.height + 28);
    context.fillStyle = jaw; context.fillRect(28, STOCK_VIEW.y + 58, 44, STOCK_VIEW.height - 116); context.fillRect(STOCK_VIEW.x + STOCK_VIEW.width, STOCK_VIEW.y + 58, 44, STOCK_VIEW.height - 116);
    context.strokeStyle = "#a4b2b45c"; context.strokeRect(28.5, STOCK_VIEW.y + 58.5, 43, STOCK_VIEW.height - 117); context.strokeRect(STOCK_VIEW.x + STOCK_VIEW.width + .5, STOCK_VIEW.y + 58.5, 43, STOCK_VIEW.height - 117);

    const stockFace = context.createLinearGradient(STOCK_VIEW.x, STOCK_VIEW.y, STOCK_VIEW.x + STOCK_VIEW.width, STOCK_VIEW.y + STOCK_VIEW.height);
    stockFace.addColorStop(0, "#7f9296"); stockFace.addColorStop(.18, "#d6dfe0"); stockFace.addColorStop(.5, "#9ba9ac"); stockFace.addColorStop(.78, "#e2e8e9"); stockFace.addColorStop(1, "#6c7d81");
    context.fillStyle = stockFace; context.fillRect(STOCK_VIEW.x, STOCK_VIEW.y, STOCK_VIEW.width, STOCK_VIEW.height);

    for (let row = 0; row < MILL_ROWS; row += 1) for (let col = 0; col < MILL_COLS; col += 1) {
      const index = row * MILL_COLS + col;
      const target = isManualTarget(contract.id, col, row);
      const x = STOCK_VIEW.x + col * cw; const y = STOCK_VIEW.y + row * ch;
      if (material[index]) {
        context.fillStyle = target ? "#c6d1d3a8" : "#91a0a38c"; context.fillRect(x, y, cw + .5, ch + .5);
      } else {
        const cavity = context.createLinearGradient(x, y, x, y + ch); cavity.addColorStop(0, target ? "#7a1730" : "#14262c"); cavity.addColorStop(.22, target ? "#3d0d1c" : "#071216"); cavity.addColorStop(1, target ? "#1c0710" : "#02080a");
        context.fillStyle = cavity; context.fillRect(x, y, cw + .5, ch + .5);
      }
      if (finished[index] && isManualBoundary(contract.id, col, row)) {
        context.strokeStyle = contract.color; context.lineWidth = 3; context.strokeRect(x + 3, y + 3, cw - 6, ch - 6);
      }
      if (target) {
        context.strokeStyle = material[index] ? contract.color : "#ff426b"; context.lineWidth = material[index] ? 2.2 : 1.4;
        const neighbors = [[-1,0],[1,0],[0,-1],[0,1]];
        neighbors.forEach(([dx,dy], edge) => { if (!isManualTarget(contract.id, col + dx, row + dy)) { context.beginPath(); if (edge === 0) { context.moveTo(x,y); context.lineTo(x,y+ch); } if (edge === 1) { context.moveTo(x+cw,y); context.lineTo(x+cw,y+ch); } if (edge === 2) { context.moveTo(x,y); context.lineTo(x+cw,y); } if (edge === 3) { context.moveTo(x,y+ch); context.lineTo(x+cw,y+ch); } context.stroke(); } });
      }
    }
    // Vise clamp line: the outer ring of cells sits under the fixture jaws.
    context.save(); context.strokeStyle = "#ffb020c0"; context.lineWidth = 2; context.setLineDash([7, 5]);
    context.strokeRect(STOCK_VIEW.x + cw, STOCK_VIEW.y + ch, STOCK_VIEW.width - cw * 2, STOCK_VIEW.height - ch * 2);
    context.restore();

    // Brushed finish and machining witness marks are clipped to the stock face.
    context.save(); context.beginPath(); context.rect(STOCK_VIEW.x, STOCK_VIEW.y, STOCK_VIEW.width, STOCK_VIEW.height); context.clip();
    for (let grain = 0; grain < STOCK_VIEW.height; grain += 5) { context.strokeStyle = grain % 15 === 0 ? "#f7ffff22" : "#1c2a2e18"; context.beginPath(); context.moveTo(STOCK_VIEW.x, STOCK_VIEW.y + grain + .5); context.lineTo(STOCK_VIEW.x + STOCK_VIEW.width, STOCK_VIEW.y + grain + .5); context.stroke(); }
    if (toolpathRef.current.length > 1) { context.strokeStyle = `${contract.color}b5`; context.lineWidth = 1.35; context.setLineDash([5,4]); context.beginPath(); toolpathRef.current.forEach((point,index) => index ? context.lineTo(sx(point.x),sy(point.y)) : context.moveTo(sx(point.x),sy(point.y))); context.stroke(); context.setLineDash([]); }
    context.restore();

    // Metrology rulers: 240 mm X by 140 mm Y with 10 mm subdivisions and G54 datum.
    context.fillStyle = "#070d0f"; context.fillRect(STOCK_VIEW.x, 22, STOCK_VIEW.width, 28); context.fillRect(30, STOCK_VIEW.y, 28, STOCK_VIEW.height);
    context.strokeStyle = "#9fb1b566"; context.fillStyle = "#8da1a6"; context.font = "700 8px ui-monospace, monospace";
    for (let tick = 0; tick <= 24; tick += 1) { const x = STOCK_VIEW.x + tick / 24 * STOCK_VIEW.width; context.beginPath(); context.moveTo(x, 50); context.lineTo(x, tick % 5 === 0 ? 34 : 42); context.stroke(); if (tick % 5 === 0) context.fillText(String(tick * 10), x + 2, 32); }
    for (let tick = 0; tick <= 14; tick += 1) { const y = STOCK_VIEW.y + tick / 14 * STOCK_VIEW.height; context.beginPath(); context.moveTo(58, y); context.lineTo(tick % 5 === 0 ? 40 : 48, y); context.stroke(); if (tick % 5 === 0) context.fillText(String(tick * 10), 32, y - 3); }
    context.fillStyle = contract.color; context.fillText("G54  X0 Y0", STOCK_VIEW.x + 8, STOCK_VIEW.y + 14);
    context.strokeStyle = "#e5eeee78"; context.lineWidth = 2; context.strokeRect(STOCK_VIEW.x, STOCK_VIEW.y, STOCK_VIEW.width, STOCK_VIEW.height);

    const radius = tool.radius * cw;
    const toolX = sx(cursor.x), toolY = sy(cursor.y);
    // Orthogonal centerlines, engagement arc, and force vector turn cutter motion into readable kinematics.
    context.save(); context.beginPath(); context.rect(STOCK_VIEW.x, STOCK_VIEW.y, STOCK_VIEW.width, STOCK_VIEW.height); context.clip();
    context.setLineDash([9, 7]); context.strokeStyle = `${contract.color}38`; context.lineWidth = 1;
    context.beginPath(); context.moveTo(STOCK_VIEW.x, toolY); context.lineTo(STOCK_VIEW.x + STOCK_VIEW.width, toolY); context.moveTo(toolX, STOCK_VIEW.y); context.lineTo(toolX, STOCK_VIEW.y + STOCK_VIEW.height); context.stroke();
    context.setLineDash([]); context.restore();
    const shank = context.createLinearGradient(toolX - 11,0,toolX + 11,0); shank.addColorStop(0,"#314247"); shank.addColorStop(.45,"#e0eaeb"); shank.addColorStop(.62,"#809397"); shank.addColorStop(1,"#233136");
    context.fillStyle = shank; context.fillRect(toolX - 9, Math.max(0, toolY - 92), 18, 78); context.strokeStyle = "#dce9ea88"; context.strokeRect(toolX - 9, Math.max(0, toolY - 92), 18, 78);
    context.beginPath(); context.arc(toolX, toolY, radius, 0, Math.PI * 2); context.strokeStyle = spindle ? contract.color : "#e9f3f4"; context.lineWidth = 3; context.stroke();
    context.beginPath(); context.arc(toolX, toolY, 4, 0, Math.PI * 2); context.fillStyle = spindle ? contract.color : "#e9f3f4"; context.fill();
    if (spindle && load > 1) {
      const path = toolpathRef.current, current = path[path.length - 1], previous = path[path.length - 2];
      const dx = current && previous ? current.x - previous.x : 1, dy = current && previous ? current.y - previous.y : 0;
      const magnitude = Math.hypot(dx, dy) || 1, tx = dx / magnitude, ty = dy / magnitude;
      const engagement = clamp(load / 100 * Math.PI * 1.65, .08, Math.PI * 1.65);
      context.beginPath(); context.arc(toolX, toolY, radius + 8, -Math.PI / 2 - engagement / 2, -Math.PI / 2 + engagement / 2); context.strokeStyle = load > 84 ? "#ff526f" : "#ffcb55"; context.lineWidth = 4; context.stroke();
      const forceLength = 32 + load * .38, forceX = toolX - ty * forceLength, forceY = toolY + tx * forceLength;
      context.strokeStyle = "#ffcb55"; context.lineWidth = 1.5; context.beginPath(); context.moveTo(toolX, toolY); context.lineTo(forceX, forceY); context.lineTo(forceX + ty * 7 - tx * 5, forceY - tx * 7 - ty * 5); context.moveTo(forceX, forceY); context.lineTo(forceX + ty * 7 + tx * 5, forceY - tx * 7 + ty * 5); context.stroke();
      context.fillStyle = "#ffdc86"; context.font = "800 8px ui-monospace, monospace"; context.fillText(`ae ${Math.round(load)}% / ${Math.round(engagement * 180 / Math.PI)}°`, toolX + radius + 14, toolY - radius - 10);
    }
    if (spindle) {
      context.save(); context.globalAlpha = .34; context.strokeStyle = "#58d9ff"; context.lineWidth = 2;
      for (let stream = -1; stream <= 1; stream += 2) { context.beginPath(); context.moveTo(toolX + stream * radius * .9, Math.max(0, toolY - radius * 3)); context.quadraticCurveTo(toolX + stream * radius * 1.6, toolY - radius, toolX + stream * radius * .45, toolY); context.stroke(); }
      context.restore();
    }
    const now = performance.now();
    chipsRef.current = chipsRef.current.filter((chip) => now - chip.born < 520);
    chipsRef.current.forEach((chip) => {
      const age = (now - chip.born) / 520, px = sx(chip.x) + chip.dx * age * cw, py = sy(chip.y) + chip.dy * age * ch + age * age * 18;
      context.globalAlpha = 1 - age; context.fillStyle = chip.hot ? "#ffb34e" : "#bdebf2"; context.fillRect(px, py, chip.hot ? 3 : 2, chip.hot ? 3 : 2);
    });
    context.globalAlpha = 1;
  }, [contract, cursor, finished, load, material, spindle, tool.radius]);

  useEffect(draw, [draw]);

  const tone = useCallback((frequency: number, duration = .08, kind: OscillatorType = "sine", volume = .025) => {
    if (!soundOn) return;
    try {
      const AudioCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      const audio = audioRef.current ?? new AudioCtor(); audioRef.current = audio;
      const oscillator = audio.createOscillator(), gain = audio.createGain(), start = audio.currentTime;
      oscillator.type = kind; oscillator.frequency.setValueAtTime(frequency, start); oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * .72), start + duration);
      gain.gain.setValueAtTime(volume, start); gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      oscillator.connect(gain).connect(audio.destination); oscillator.start(start); oscillator.stop(start + duration);
    } catch { /* audio is optional and must never interrupt play */ }
  }, [soundOn]);

  const announceGameEvent = useCallback((event: Omit<GameEvent, "id">) => {
    if (eventTimerRef.current !== null) window.clearTimeout(eventTimerRef.current);
    setGameEvent({ ...event, id: Date.now() });
    eventTimerRef.current = window.setTimeout(() => setGameEvent(null), event.kind === "warning" ? 1800 : 2400);
  }, []);

  const toolForOperation = (operationId: ManualOperationId) => Math.max(0, MILL_TOOLS.findIndex((item) => item.operations.includes(operationId)));

  const resetRun = useCallback((nextContract = contractIndex) => {
    const next = MANUAL_CONTRACTS[nextContract];
    const freshStock = createManualStock(); const freshFinish = createManualFinishMap();
    materialRef.current = freshStock; finishedRef.current = freshFinish; milestoneRef.current.clear();
    setContractIndex(nextContract); setOperationIndex(0); setToolIndex(toolForOperation(next.operations[0].id));
    setMaterial(freshStock); setFinished(freshFinish); setSpindle(false); setHeat(20); setCondition(100);
    setLoad(0); setOvercut(0); setFixtureStrikes(0); setFinishPenalty(0); setBreaks(0); setElapsed(0); setCursor({ x: 3, y: 3 }); setResult(null); setShareStatus(""); setViewMode("map"); firstCutTracked.current = false; toolpathRef.current = []; setToolpath([]); chipsRef.current = [];
    setMeasured({}); setInspectionMistakes(0); setSelectedCharacteristic(next.inspection[0].id); setInstrument(next.inspection[0].instrument);
    comboRef.current = 0; setCombo(0); setBestCombo(0); setFlowScore(0); setPaused(false); setGameEvent(null);
  }, [contractIndex]);

  const persistSave = (next: ManualSaveData) => {
    setSave(next);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(next)); } catch { /* optional */ }
  };

  const selectTool = (index: number) => {
    if (spindle) { setMessage("FEED HOLD first — stop the spindle before a tool change."); return; }
    const nextTool = MILL_TOOLS[index];
    const compatible = nextTool.operations.includes(operation.id);
    setLoad(0);
    setToolIndex(index);
    setMessage(`SAFE TOOL CHANGE — T${nextTool.id} ${nextTool.name} selected. ${compatible ? nextTool.role : nextTool.limitation}`);
    trackAnonymous("manual_tool_change", { contract: contract.id, tool: nextTool.id, duringCycle: spindle });
  };

  const retryContract = useCallback(() => {
    retryStartedAt.current = performance.now(); trackAnonymous("retry_start", { contract: contract.id });
    tone(145, .12, "triangle", .018);
    resetRun();
    setScreen("play");
    setMessage(`Fresh stock loaded. Complete ${MANUAL_CONTRACTS[contractIndex].operations[0].label.toLowerCase()} first.`);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const measured = Math.round(performance.now() - retryStartedAt.current); setRetryMs(measured); cycleButtonRef.current?.focus();
      trackAnonymous("retry_ready", { contract: contract.id, milliseconds: measured });
    }));
  }, [contract.id, contractIndex, resetRun, tone]);

  const startContract = (index: number) => {
    resetRun(index); setScreen("play"); setRetryMs(null); setMessage(`${MANUAL_CONTRACTS[index].program} loaded. Complete ${MANUAL_CONTRACTS[index].operations[0].label.toLowerCase()} first.`);
    const firstRun = localStorage.getItem("toolpath-first-run-complete-v1") !== "yes"; setShowCoach(firstRun);
    trackAnonymous(index === 0 ? "flagship_start" : "cycle_start", { contract: MANUAL_CONTRACTS[index].id, entry: "contract" });
  };

  const goToTourStep = (next: number) => {
    if (next < 0 || next >= TOUR_STEPS.length) { setTourStep(null); setViewMode("map"); return; }
    if (next >= 2 && screen === "select") { startContract(contractIndex); setShowCoach(false); }
    if (next === 3) { setSpindle(false); setLoad(0); setViewMode("twin"); }
    else if (viewMode === "twin") setViewMode("map");
    setTourStep(next); trackAnonymous("guided_tour_step", { step: next + 1, screen });
  };

  const cutAt = (x: number, y: number) => {
    setCursor({ x, y });
    if (!spindle || condition <= 0 || paused || viewMode === "twin") return;
    const cut = machineManualStock(materialRef.current, finishedRef.current, contract.id, operation.id, tool, x, y);
    if (!cut.compatible) { setLoad(0); setMessage(`T${tool.id} LOCKOUT — ${tool.name.toLowerCase()} cannot perform ${operation.label.toLowerCase()}.`); return; }
    if (!cut.engagement) { setLoad(0); if (cut.mismatch) setMessage(`${operation.label.toUpperCase()} ACTIVE — that stock belongs to another operation.`); return; }
    toolpathRef.current.push({ x, y }); toolpathRef.current = toolpathRef.current.slice(-320); setToolpath(toolpathRef.current);
    if (!firstCutTracked.current) { firstCutTracked.current = true; trackAnonymous("first_cut", { contract: contract.id, tool: tool.id, feed }); }
    const nextLoad = clamp(Math.round(cut.engagement * 7.6 * tool.load * (feed / 55)), 0, 100);
    const now = performance.now();
    for (let chip = 0; chip < Math.min(10, cut.engagement + 2); chip += 1) { const angle = (chip / Math.max(1, cut.engagement + 2)) * Math.PI * 2 + now * .002; chipsRef.current.push({ x, y, dx: Math.cos(angle) * (1.2 + chip % 3), dy: Math.sin(angle) * (1 + chip % 2), born: now, hot: nextLoad > 78 || cut.overcut > 0 }); }
    chipsRef.current = chipsRef.current.slice(-48);
    if (now - lastCutTone.current > 75) { tone(cut.overcut ? 92 : 230 + nextLoad * 2.2, .055, cut.overcut ? "sawtooth" : "square", cut.overcut ? .035 : .012); lastCutTone.current = now; }
    const heatGain = cut.engagement * .45 * tool.load * (feed / 50);
    const wear = cut.engagement * .055 * tool.wear * (1 + Math.max(0, feed - 70) / 35) + cut.fixtureStrikes * 14;
    materialRef.current = cut.material; finishedRef.current = cut.finished;
    setMaterial(cut.material); setFinished(cut.finished); setOvercut((value) => value + cut.overcut); setFixtureStrikes((value) => value + cut.fixtureStrikes); setLoad(nextLoad);
    if (cut.fixtureStrikes > 0) {
      comboRef.current = 0; setCombo(0);
      announceGameEvent({ kind: "warning", title: "FIXTURE STRIKE", detail: "Cutter contacted the vise clamp at the stock edge. Stay inside the margin." });
      tone(60, .12, "sawtooth", .05);
    }
    const safeCut = cut.correct > 0 && cut.overcut === 0 && cut.fixtureStrikes === 0 && nextLoad <= 84;
    if (safeCut) {
      lastComboCutRef.current = now;
      comboRef.current = Math.min(99, comboRef.current + 1);
      setCombo(comboRef.current);
      setBestCombo((best) => Math.max(best, comboRef.current));
      setFlowScore((value) => value + deriveFlowPoints(cut.correct, comboRef.current).points);
    } else if (cut.overcut > 0 || nextLoad > 92) {
      comboRef.current = 0; setCombo(0);
      announceGameEvent({ kind: "warning", title: cut.overcut > 0 ? "PROFILE STRIKE" : "LOAD LIMIT", detail: cut.overcut > 0 ? "Combo lost. Retract from the glowing edge." : "Combo lost. Reduce engagement or feed." });
    }
    const nextCompletion = manualCompletion(cut.material, contract.id);
    for (const threshold of [35, 70, 90]) if (completion < threshold && nextCompletion >= threshold && !milestoneRef.current.has(threshold)) {
      milestoneRef.current.add(threshold);
      const title = threshold === 35 ? "ENTRY PATH OPEN" : threshold === 70 ? "ROUGHING PASS COMPLETE" : "INSPECTION UNLOCKED";
      announceGameEvent({ kind: threshold === 90 ? "reward" : "objective", title, detail: threshold === 90 ? "Sign off the final operation and open inspection." : `Material removal reached ${threshold}%. Keep the profile protected.` });
      tone(threshold === 90 ? 740 : 440 + threshold * 2, .16, "sine", .025);
    }
    setHeat((value) => clamp(value + heatGain, 18, 100));
    setCondition((value) => {
      const next = clamp(value - wear, 0, 100);
      if (next <= 0 && value > 0) { setBreaks((count) => count + 1); setSpindle(false); setMessage(cut.fixtureStrikes > 0 ? "TOOL FAILURE — the vise clamp took the edge off the cutter." : "TOOL FAILURE — reset the cutter and reduce engagement."); }
      return next;
    });
    setFinishPenalty((value) => operation.id === "finish"
      ? Math.max(0, value - cut.correct * .075)
      : value + Math.max(0, nextLoad - 82) * .018 * tool.finish + cut.overcut * .25);
  };

  const millAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width * canvas.width, py = (clientY - rect.top) / rect.height * canvas.height;
    cutAt(clamp((px - STOCK_VIEW.x) / STOCK_VIEW.width * MILL_COLS - .5, 0, MILL_COLS - 1), clamp((py - STOCK_VIEW.y) / STOCK_VIEW.height * MILL_ROWS - .5, 0, MILL_ROWS - 1));
  };

  const moveCursor = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width * canvas.width, py = (clientY - rect.top) / rect.height * canvas.height;
    setCursor({
      x: clamp((px - STOCK_VIEW.x) / STOCK_VIEW.width * MILL_COLS - .5, 0, MILL_COLS - 1),
      y: clamp((py - STOCK_VIEW.y) / STOCK_VIEW.height * MILL_ROWS - .5, 0, MILL_ROWS - 1),
    });
  };

  const restoreTool = () => { setCondition(100); setHeat(25); setSpindle(false); setMessage("Fresh cutter loaded. Verify the active operation before restart."); };

  const toggleSpindle = () => {
    if (viewMode === "twin") { setViewMode("map"); setMessage("CUT MAP ACTIVE — verify position, then start the cycle."); return; }
    if (condition <= 0) { restoreTool(); return; }
    if (!toolCompatible) { setMessage(`SETUP HOLD — choose a tool rated for ${operation.label.toLowerCase()}.`); return; }
    if (!spindle) { trackAnonymous("cycle_start", { contract: contract.id, feed, tool: tool.id }); tone(185, .14, "triangle", .032); window.setTimeout(() => tone(310, .09, "sine", .018), 70); } else tone(120, .09, "triangle", .018);
    setSpindle((value) => !value); setMessage(spindle ? "FEED HOLD — spindle stopped." : `${operation.label.toUpperCase()} LIVE — ${operation.instruction}`);
  };

  const advanceOperation = () => {
    if (operationProgress < operation.requiredProgress) { setMessage(`${operation.label.toUpperCase()} HOLD — reach ${operation.requiredProgress}% before signoff.`); return; }
    setSpindle(false); setLoad(0);
    if (operationIndex < contract.operations.length - 1) {
      const nextIndex = operationIndex + 1; const nextOperation = contract.operations[nextIndex];
      setOperationIndex(nextIndex); setToolIndex(toolForOperation(nextOperation.id));
      setMessage(`${operation.label.toUpperCase()} SIGNED OFF — ${nextOperation.label.toLowerCase()} is now active.`);
    } else {
      setMeasured({}); setInspectionMistakes(0); setSelectedCharacteristic(contract.inspection[0].id); setInstrument(contract.inspection[0].instrument);
      setViewMode("map"); setScreen("inspection"); setMessage("INSPECTION BAY — measure every characteristic, then disposition the part.");
    }
  };

  const measureSelected = () => {
    const reading = readings.find((item) => item.id === selectedCharacteristic);
    if (!reading) return;
    if (instrument !== reading.instrument) { setInspectionMistakes((value) => value + 1); setMessage(`NO VALID READING — ${reading.label.toLowerCase()} requires the ${reading.instrumentLabel.toLowerCase()}.`); return; }
    setMeasured((current) => ({ ...current, [reading.id]: reading }));
    setElapsed((value) => value + 2);
    setMessage(`${reading.label.toUpperCase()} — ${reading.actual.toFixed(3)} ${reading.unit}, ${reading.pass ? "WITHIN" : "OUTSIDE"} ±${reading.tolerance.toFixed(2)}.`);
  };

  const dispositionPart = (chosen: InspectionDisposition) => {
    const recommended = recommendedManualDisposition(readings, contract, overcut);
    const evaluation = evaluateManualDisposition(chosen, recommended, Object.keys(measured).length, readings.length);
    if (!evaluation.complete) { setMessage("INSPECTION INCOMPLETE — measure every characteristic before disposition."); return; }
    if (!evaluation.correct) { setInspectionMistakes((value) => value + 1); setMessage(`DISPOSITION BLOCKED — the findings do not support ${chosen.toUpperCase()}.`); return; }
    const inspectionScore = Math.max(4, evaluation.inspectionScore - inspectionMistakes * 2);
    if (chosen === "rework") {
      const failed = readings.find((item) => !item.pass);
      const targetOperation = failed?.source === "finish" ? "finish" : failed?.source === "feature" ? (contract.operations.some((item) => item.id === "drill") ? "drill" : "pocket") : "profile";
      const nextIndex = Math.max(0, contract.operations.findIndex((item) => item.id === targetOperation));
      setOperationIndex(nextIndex); setToolIndex(toolForOperation(contract.operations[nextIndex].id)); setMeasured({}); setScreen("play");
      setMessage(`REWORK ROUTED — return to ${contract.operations[nextIndex].label.toLowerCase()} and correct the failed characteristic.`);
      return;
    }
    const grade = gradeManualRun(material, contract, overcut, finishPenalty, elapsed, breaks, fixtureStrikes, inspectionScore, operationsComplete);
    const finalResult: RunResult = { ...grade, disposition: chosen };
    setPreviousBest(save.bests[contract.id] ?? null);
    const attemptSave = recordManualAttempt(save, contract, finalResult);
    const now = Date.now();
    const bests = grade.accepted && (!attemptSave.bests[contract.id] || grade.score > (attemptSave.bests[contract.id]?.score ?? 0))
      ? { ...attemptSave.bests, [contract.id]: { score: grade.score, precision: grade.precision, completion: grade.completion, elapsed, geometry: grade.geometry, finish: grade.finish, time: grade.time } }
      : attemptSave.bests;
    const logEntry: ShopRunLogEntry = { id: `${now}-${contract.id}`, contract: contract.id, program: contract.program, title: contract.title, score: grade.score, rank: grade.rank, accepted: grade.accepted, completion: grade.completion, precision: grade.precision, finish: grade.finish, elapsed, overcut, at: now };
    persistSave({ ...attemptSave, bests, log: appendShopRunLog(attemptSave.log, logEntry) });
    setResult(finalResult); setSpindle(false); setScreen("result");
    trackAnonymous("inspection_complete", { contract: contract.id, score: grade.score, accepted: grade.accepted, completion: grade.completion, overcut });
    tone(grade.accepted ? 660 : 105, grade.accepted ? .24 : .3, grade.accepted ? "sine" : "sawtooth", .04);
    setMessage(chosen === "scrap" ? "PART SCRAPPED — correct disposition protected the customer." : grade.accepted ? `PART ACCEPTED — ${grade.rank} rank.` : "PART HELD — findings did not support release.");
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (tourStep !== null || logOpen || screen === "inspection") return;
      if (screen === "result") {
        if (key === "r") { event.preventDefault(); retryContract(); }
        if (event.code === "Space") {
          event.preventDefault();
          if (result?.accepted && contractIndex < MANUAL_CONTRACTS.length - 1) startContract(contractIndex + 1);
          else retryContract();
        }
        return;
      }
      if (screen !== "play") return;
      if (event.key === "Escape") { event.preventDefault(); setSpindle(false); setPaused((value) => !value); return; }
      if ((event.target as HTMLElement)?.matches("input,button,a")) return;
      if (paused) return;
      if (event.code === "Space") { event.preventDefault(); toggleSpindle(); return; }
      if (key === "i") { event.preventDefault(); advanceOperation(); return; }
      if (key === "v") { event.preventDefault(); setSpindle(false); setViewMode((value) => value === "map" ? "twin" : "map"); return; }
      if (key === "r") { event.preventDefault(); resetRun(); setMessage("Fresh stock loaded. Process plan retained."); return; }
      const motion = key === "a" || event.key === "ArrowLeft" ? [-.7, 0] : key === "d" || event.key === "ArrowRight" ? [.7, 0] : key === "w" || event.key === "ArrowUp" ? [0, -.7] : key === "s" || event.key === "ArrowDown" ? [0, .7] : null;
      if (motion) { event.preventDefault(); cutAt(clamp(cursor.x + motion[0], 0, MILL_COLS - 1), clamp(cursor.y + motion[1], 0, MILL_ROWS - 1)); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advanceOperation, contractIndex, cursor.x, cursor.y, logOpen, paused, result?.accepted, retryContract, screen, spindle, toggleSpindle, tourStep, viewMode]);

  const swapTool = () => {
    if (spindle) { setMessage("FEED HOLD first — stop the spindle before a tool swap."); return; }
    if (condition >= 98 && heat <= 30) { setMessage("Cutter is already fresh and cool. No swap needed."); return; }
    if (save.credits < SWAP_TOOL_COST) { setMessage(`Not enough credits for a tool swap — need ${SWAP_TOOL_COST} CR.`); return; }
    setSave((current) => ({ ...current, credits: current.credits - SWAP_TOOL_COST }));
    setCondition(100); setHeat(20);
    setMessage(`Cutter swapped for ${SWAP_TOOL_COST} CR — fresh edge, safe temperature.`);
    trackAnonymous("manual_tool_swap", { contract: contract.id, tool: tool.id, cost: SWAP_TOOL_COST });
  };
  const inspectionBands = result ? [
    { label: "PROFILE", value: result.precision / 30 * 100, reading: `${overcut}/${contract.tolerance} CELLS` },
    { label: "MATERIAL", value: result.completion, reading: `${result.completion}% CLEAR` },
    { label: "SURFACE", value: result.finish / 14 * 100, reading: `Ra ${surfaceRa.toFixed(1)} µm` },
    { label: "CYCLE", value: result.time / 10 * 100, reading: `${elapsed}s / ${contract.par}s par` },
  ] : [];

  return <main className={styles.shell} data-tour-step={tourStep ?? undefined} style={{ "--accent": contract.color } as React.CSSProperties}>
    <header className={styles.header}>
      <div className={styles.brand}><Factory/><span>PROJECT TOOLPATH</span><strong>MANUAL MILL // CELL 01</strong></div>
      <div className={styles.shift}><i/> CREATIVE MACHINING LAB <b>SHIFT 01</b></div>
      <div className={styles.profile}><span>REP <b>{save.reputation}</b></span><span>CREDITS <b>{save.credits.toLocaleString()}</b></span><button className={styles.helpButton} onClick={() => { setTourStep(0); trackAnonymous("guided_tour_open", { surface: screen }); }}><CircleHelp/> HELP / TOUR</button><button className={styles.shopLogButton} onClick={() => { setLogOpen(true); trackAnonymous("shop_log_open", { surface: screen }); }}><BookOpen/> SHOP LOG</button><button className={styles.soundToggle} onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? "Mute game audio" : "Enable game audio"}>{soundOn ? <Volume2/> : <VolumeX/>}</button></div>
    </header>

    {screen === "select" ? <ContractSelect save={save} startContract={startContract} learningLevel={learningLevel} setLearningLevel={setLearningLevel}/> : <>
      <section className={styles.jobbar}>
        <button onClick={() => { setSpindle(false); setScreen("select"); }}>&larr; CONTRACT INDEX</button>
        <div><small>{contract.client} / {contract.program}</small><b>{contract.title}</b></div>
        <div className={styles.jobstats}><span>OP <b>{operation.label.toUpperCase()}</b></span><span>MAT <b>{contract.material}</b></span><span>PAR <b>{contract.par}s</b></span><span>TOL <b>{contract.tolerance} cells</b></span></div>
      </section>

      {screen === "inspection" ? <InspectionBay readings={readings} measured={measured} selectedCharacteristic={selectedCharacteristic} setSelectedCharacteristic={setSelectedCharacteristic} instrument={instrument} setInstrument={setInstrument} measureSelected={measureSelected} dispositionPart={dispositionPart} returnToCell={() => setScreen("play")}/> : <section className={styles.workspace}>
        <aside className={styles.setup}>
          <div className={styles.panelTitle}><span>01</span><div><small>PROCESS PLAN</small><b>Sequence and tooling</b></div></div>
          <div className={styles.operationList}>{contract.operations.map((item, index) => {
            const progress = manualOperationProgress(material, finished, contract.id, item.id);
            return <div key={item.id} className={index < operationIndex ? styles.operationDone : index === operationIndex ? styles.operationActive : ""}><span>0{index + 1}</span><div><b>{item.label}</b><small>{index < operationIndex ? "SIGNED OFF" : index === operationIndex ? `${progress}% / ${item.requiredProgress}% required` : "LOCKED"}</small></div><em>{index < operationIndex ? "✓" : `${progress}%`}</em></div>;
          })}</div>
          <div className={styles.toolList}>{MILL_TOOLS.map((item, index) => {
            const compatible = item.operations.includes(operation.id);
            return <button key={item.id} aria-pressed={index === toolIndex} className={index === toolIndex ? styles.activeTool : ""} onClick={() => selectTool(index)}>
              <span>T{item.id}</span><div><b>{item.name}</b><small>{item.diameter} / {compatible ? item.role : item.limitation}</small></div><em>{item.radius.toFixed(2)}R</em>
            </button>;
          })}</div>
          <label className={styles.feed}><span>FEED OVERRIDE <b>{feed}%</b></span><input type="range" min="25" max="115" value={feed} onChange={(event) => setFeed(Number(event.target.value))}/></label>
          <div className={styles.strategy}><Hexagon/><p><b>{operation.label.toUpperCase()} NOTE</b>{operation.instruction} Larger cutters remove stock faster, but a tool not rated for this operation will lock out entirely.</p></div>
          <div className={styles.cellLearning}><span>EXPLANATION DEPTH</span><div>{(Object.keys(LEARNING_LENSES) as LearningLevel[]).map((level) => <button key={level} aria-pressed={learningLevel === level} onClick={() => { setLearningLevel(level); trackAnonymous("learning_lens_change", { level, surface: "machine" }); }}>{LEARNING_LENSES[level].label}</button>)}</div><p><b>{LEARNING_LENSES[learningLevel].eyebrow}</b>{LEARNING_LENSES[learningLevel].play}</p></div>
          <button className={styles.reset} onClick={() => { resetRun(); setMessage("Stock and process plan reset."); }}><RotateCcw/> RESET CONTRACT</button>
          <button className={styles.reset} onClick={swapTool}><Wrench/> SWAP TOOL ({SWAP_TOOL_COST} CR)</button>
        </aside>

        <article className={styles.machine}>
          <div className={styles.machineHead}><span><i/> VMC-01 / MULTI-OP TRAINING CELL</span><span>G54 / 240 × 140 × 18 MM</span><div className={styles.viewSwitch} aria-label="Machine viewport mode"><button aria-pressed={viewMode === "map"} onClick={() => setViewMode("map")}>CUT MAP</button><button aria-pressed={viewMode === "twin"} onClick={() => { setSpindle(false); setLoad(0); setViewMode("twin"); setMessage("3D TWIN — spindle held at safe Z for visual review."); trackAnonymous("view_3d_twin", { contract: contract.id, completion }); }}>3D TWIN</button></div><span>PROGRAM <b>{contract.program}</b></span></div>
          <div className={styles.viewport}>
            <canvas ref={canvasRef} width={1120} height={640} aria-label={`Interactive ${operation.label.toLowerCase()} operation`} onPointerDown={(event) => { dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); millAt(event.clientX, event.clientY); }} onPointerMove={(event) => dragging.current ? millAt(event.clientX, event.clientY) : moveCursor(event.clientX, event.clientY)} onPointerUp={() => { dragging.current = false; setLoad(0); }} onPointerCancel={() => { dragging.current = false; setLoad(0); }}/>
            {learningLevel !== "easy" && <div className={styles.coordinates}><small>G54 POSITION / MM</small><b>X {machinePosition.x.toFixed(2)}</b><b>Y {machinePosition.y.toFixed(2)}</b><b>Z {spindle ? "-1.80" : "+4.00"}</b></div>}
            <div className={styles.processPlate}><small>PROCESS ESTIMATE / SIM</small><span><b>S</b>{spindleRpm.toLocaleString()} RPM</span><span><b>F</b>{programmedFeed} MM/MIN</span>{learningLevel !== "easy" && <span><b>Ra</b>{surfaceRa.toFixed(1)} µm</span>}{learningLevel === "hard" && <><span><b>fz</b>{chipLoad.toFixed(3)} MM</span><span><b>ae</b>{engagementAngle}°</span><span><b>MRR</b>{removalIndex}</span><span><b>WCS</b>G54</span><span><b>OP</b>{operation.label.toUpperCase()}</span></>}</div>
            <section className={styles.missionHud} aria-label="Active mission objective"><header><Target/><span>PRIMARY OBJECTIVE / 0{mission.step}</span><b>{completion}% / {mission.target}%</b></header><h3>{mission.title}</h3><p>{mission.detail}</p><i><em style={{ width: `${Math.min(100, completion / mission.target * 100)}%` }}/></i></section>
            {learningLevel !== "easy" && <div className={styles.flowHud} data-active={combo > 1}><Zap/><span>FLOW</span><strong>×{comboMultiplier.toFixed(2)}</strong><small>{combo} CHAIN · {flowScore.toLocaleString()} PTS</small></div>}
            {gameEvent && <div key={gameEvent.id} className={styles.gameEvent} data-kind={gameEvent.kind} role="status"><Sparkles/><span>{gameEvent.kind === "warning" ? "PROCESS WARNING" : "MISSION UPDATE"}</span><strong>{gameEvent.title}</strong><small>{gameEvent.detail}</small></div>}
            <div className={styles.legend}><span><i className={styles.keep}/> PART</span><span><i className={styles.waste}/> ACTIVE OP</span><span><i className={styles.damage}/> OVERCUT</span><span><i className={styles.fixtureSwatch}/> VISE CLAMP</span></div>
            {!spindle && <div className={styles.prompt}><Crosshair/><b>{operationProgress ? "OPERATION PAUSED" : `${operation.label.toUpperCase()} SETUP`}</b><span>{operation.instruction}</span></div>}
            <FlagshipMachiningKit cursor={cursor} spindle={spindle} completion={completion} load={load} material={contract.material} accent={contract.color} verbose={learningLevel !== "easy"} cells={material} contractId={contract.id} toolpath={toolpath} toolId={tool.id} interactive/>
            {viewMode === "twin" && <section className={styles.twinReview} aria-label="Full-frame 3D machining twin review"><FlagshipMachiningKit cursor={cursor} spindle={false} completion={completion} load={load} variant="full" material={contract.material} accent={contract.color} verbose={learningLevel !== "easy"} cells={material} contractId={contract.id} toolpath={toolpath} toolId={tool.id}/><div className={styles.twinTitle}><small>DIGITAL TWIN / VISUAL REVIEW</small><b>FIXTURE + TOOL + STOCK</b><span>LIVE GLB / SAFE Z</span></div><div className={styles.twinCoordinates}><span>X <b>{machinePosition.x.toFixed(2)}</b></span><span>Y <b>{machinePosition.y.toFixed(2)}</b></span><span>Z <b>+4.00</b></span><small>G54 / MM</small></div><div className={styles.twinProgress}><span>STOCK REMOVAL</span><strong>{completion}%</strong><i><em style={{ width: `${completion}%` }}/></i><div><small>TOOL</small><b>T{tool.id} / {tool.diameter}</b><small>FIXTURE</small><b>VISE / PARALLELS</b><small>STATE</small><b>REVIEW HOLD</b></div></div><div className={styles.twinCallouts} aria-hidden="true"><span className={styles.twinSpindle}>01 / SPINDLE BODY</span><span className={styles.twinTool}>02 / CUTTER CENTER</span><span className={styles.twinStock}>03 / STOCK ENVELOPE</span><span className={styles.twinFixture}>04 / FIXTURE STACK</span></div><button className={styles.returnMap} onClick={() => { setViewMode("map"); setMessage("CUT MAP ACTIVE — resume from the recorded tool position."); }}>RETURN TO CUT MAP <Crosshair/></button></section>}
            {showCoach && <div className={styles.coach} role="dialog" aria-label="First run briefing"><small>FIRST CUT / 20 SECONDS</small><b>SILVER GOES. CYAN STAYS.</b><ol><li>Press cycle start.</li><li>Drag through silver stock.</li><li>Sign off each operation, then inspect.</li></ol><button onClick={() => { localStorage.setItem("toolpath-first-run-complete-v1", "yes"); setShowCoach(false); cycleButtonRef.current?.focus(); }}>I&apos;M READY</button></div>}
          </div>
          <div className={styles.controls}>
            <button ref={cycleButtonRef} className={spindle ? styles.hold : styles.start} onClick={toggleSpindle}>{spindle ? <Pause/> : <Play/>}<span>{viewMode === "twin" ? "RETURN TO MAP" : spindle ? "FEED HOLD" : condition <= 0 ? "CHANGE TOOL" : !toolCompatible ? "SELECT VALID TOOL" : "CYCLE START"}</span></button>
            <div className={styles.timeline}><i style={{ width: `${operationProgress}%` }}/><span>{operation.label.toUpperCase()} {operationProgress}% / OVERALL {completion}%</span></div>
            <button className={styles.inspect} onClick={advanceOperation}><ScanLine/> {operationIndex < contract.operations.length - 1 ? "SIGN OFF OP" : "OPEN INSPECTION"}</button>
          </div>
          <div className={styles.message} role="status"><Activity/>{message}<span className={styles.keyHints}><kbd>WASD</kbd> MOVE <kbd>SPACE</kbd> SPINDLE <kbd>I</kbd> SIGN OFF <kbd>ESC</kbd> PAUSE</span>{retryMs !== null && <b className={retryMs < 3000 ? styles.readyFast : styles.readySlow}>RESET READY {retryMs}MS</b>}</div>
        </article>

        <aside className={styles.telemetry}>
          <div className={styles.panelTitle}><span>02</span><div><small>LIVE TELEMETRY</small><b>Process window</b></div></div>
          <div className={styles.completion}><CircleGauge/><strong>{operationProgress}%</strong><span>{operation.label.toUpperCase()}</span></div>
          <Meter icon={<Gauge/>} label="SPINDLE LOAD" value={load} suffix="%" danger={load > 84}/>
          <Meter icon={<Activity/>} label="TOOL HEAT" value={heat} suffix="°C" danger={heat > 78}/>
          <Meter icon={<Wrench/>} label="TOOL CONDITION" value={condition} suffix="%" danger={condition < 24}/>
          <div className={styles.coolant}><Waves/><span><b>COOLANT FIELD</b>{spindle ? "ACTIVE / CHIP EVACUATION" : "STANDBY / SAFE Z"}</span><i className={spindle ? styles.coolantLive : ""}/></div>
          <dl><div><dt>ELAPSED</dt><dd>{String(Math.floor(elapsed/60)).padStart(2,"0")}:{String(elapsed%60).padStart(2,"0")}</dd></div><div><dt>OVERCUT CELLS</dt><dd className={overcut > contract.tolerance ? styles.bad : ""}>{overcut}</dd></div><div><dt>FIXTURE STRIKES</dt><dd className={fixtureStrikes > 0 ? styles.bad : ""}>{fixtureStrikes}</dd></div><div><dt>TOOL FIT</dt><dd className={!toolCompatible ? styles.bad : ""}>{toolCompatible ? "VALID" : "LOCKED"}</dd></div><div><dt>TOOL</dt><dd>T{tool.id} / {tool.diameter}</dd></div>{learningLevel !== "easy" && <><div><dt>SPINDLE / SIM</dt><dd>{spindleRpm.toLocaleString()} RPM</dd></div><div><dt>FEED / SIM</dt><dd>{programmedFeed} MM/MIN</dd></div></>}{learningLevel === "hard" && <><div><dt>CHIP LOAD / SIM</dt><dd>{chipLoad.toFixed(3)} MM</dd></div><div><dt>ENGAGEMENT</dt><dd>{engagementAngle}°</dd></div><div><dt>WORK OFFSET</dt><dd>G54</dd></div></>}</dl>
          <div className={styles.safety}><ShieldCheck/><p><b>CREATIVE SIMULATION</b>Not machine-operating guidance. Never transfer game values to physical equipment.</p></div>
        </aside>
      </section>}
    </>}

    {screen === "result" && result && <section className={styles.resultBackdrop}>
      <article className={styles.resultCard} data-verdict={result.accepted ? "accepted" : "hold"}>
        <div className={styles.resultHero}><div className={styles.rank}><Award/><span>{result.disposition === "scrap" ? "SCRAP DECISION CONFIRMED" : result.accepted ? "INSPECTION ACCEPTED" : "INSPECTION HOLD"}</span><strong>{result.disposition === "scrap" ? "X" : result.rank}</strong><small>{result.score} / 100</small></div><section className={styles.inspectionMap} aria-label="Simulated dimensional inspection visualization"><header><span>CMM PROFILE REPORT / SIM</span><b>{contract.program}</b><i>{result.accepted ? "RELEASE" : "REWORK"}</i></header><div className={styles.inspectionGeometry}><GeometryPreview contract={contract}/><i className={styles.inspectionX}/><i className={styles.inspectionY}/><span>G54</span><b>PROFILE TRACE<br/>240 × 140 MM FIELD</b></div><div className={styles.deviationBands}>{inspectionBands.map((band) => <div key={band.label}><span>{band.label}</span><i><em style={{ width: `${clamp(band.value, 0, 100)}%` }}/></i><b>{band.reading}</b></div>)}</div><footer><span>MAT <b>{contract.material}</b></span><span>WCS <b>G54</b></span><span>TOOL <b>T{tool.id}</b></span><span>TRACE <b>{result.accepted ? "IN BAND" : "OUT OF BAND"}</b></span></footer></section></div>
        <div className={styles.resultData}><div><span>GEOMETRY</span><b>{result.geometry}/46</b><small>{result.completion}% waste cleared</small></div><div><span>PRECISION</span><b>{result.precision}/30</b><small>{overcut}/{contract.tolerance} overcut cells</small></div><div><span>FINISH</span><b>{result.finish}/14</b><small>{finishPenalty.toFixed(1)} risk index</small></div><div><span>INSPECTION</span><b>{result.inspection}/10</b><small>{inspectionMistakes} inspection mistakes</small></div></div>
        <div className={styles.scoreProof}><span>SCORE PROOF</span><code>{result.geometry} + {result.precision} + {result.finish} + {result.time} + {result.inspection} − {result.breakPenalty} = <b>{result.score}</b></code><i>{result.completion >= 90 ? "✓" : "×"} COMPLETION ≥90%</i><i>{overcut <= contract.tolerance ? "✓" : "×"} OVERCUT ≤{contract.tolerance}</i><i>{fixtureStrikes === 0 ? "✓" : "×"} NO FIXTURE STRIKES</i></div>
        <div className={styles.runSignature}><Gamepad2/><span>RUN SIGNATURE</span><b>{flowScore.toLocaleString()} FLOW PTS</b><i>BEST CHAIN ×{bestCombo}</i><small>Flow rewards controlled consecutive cuts; it never changes the inspection grade.</small></div>
        <p>{result.disposition === "scrap" ? "The failed tolerance was correctly contained. Reset the stock and revise the process." : result.accepted ? `Released to ${contract.client}. ${result.payout.toLocaleString()} credits earned.` : "Remove at least 90% of the waste and stay within tolerance across every operation."}</p>
        <div className={rapidStyles.improvement}><b>{previousBest ? `${result.score >= previousBest.score ? "+" : ""}${result.score - previousBest.score} VS PERSONAL BEST` : "FIRST VALID RESULT SETS YOUR BENCHMARK"}</b><span>{result.accepted ? (result.precision < 26 ? "Next run: protect the glowing part edge more carefully." : result.completion < 98 ? "Next run: clear the remaining silver stock." : "Next run: preserve quality with a shorter path.") : "Fastest recovery: retry fresh stock, then follow the process plan in order."}</span></div>
        <div className={styles.careerPulse}><span>SHOP SKILL RECORD</span><b>{shopProgress.current.role}</b><button onClick={() => setLogOpen(true)}>REVIEW LOG <BookOpen/></button><i><em style={{ width: `${shopProgress.progress}%` }}/></i><small>{shopProgress.next ? `${Math.max(0, shopProgress.next.threshold - shopProgress.xp)} BEST-RUN XP TO ${shopProgress.next.role}` : "CURRENT DEMO LADDER COMPLETE"}</small></div>
        {shareStatus && <div className={styles.shareStatus} role="status">{shareStatus}</div>}
        <div className={`${styles.resultActions} ${rapidStyles.actions}`}><button onClick={() => { setScreen("inspection"); setMessage("Inspection record reopened for review."); }}>REVIEW FINDINGS</button><button onClick={async () => { try { const status = await shareResultCard({ contract: contract.title, program: contract.program, rank: result.rank, score: result.score, accepted: result.accepted, geometry: result.geometry, precision: result.precision, finish: result.finish, time: result.time, personalBestDelta: previousBest ? result.score - previousBest.score : null }); setShareStatus(status); trackAnonymous("result_share", { contract: contract.id, score: result.score }); } catch { setShareStatus("SHARE CANCELLED — RESULT KEPT"); } }}><Share2/> SHARE RESULT CARD</button><button onClick={retryContract}>RETRY FOR BETTER SCORE <kbd>R</kbd></button><button className={styles.primary} onClick={() => result.accepted && contractIndex < MANUAL_CONTRACTS.length - 1 ? startContract(contractIndex + 1) : result.accepted ? setScreen("select") : retryContract()}>{result.accepted ? contractIndex < 2 ? "START NEXT CONTRACT" : "CAMPAIGN INDEX" : "RETRY NOW"} <kbd>SPACE</kbd></button></div>
      </article>
    </section>}
    {logOpen && <ShopLog save={save} close={() => setLogOpen(false)}/>}
    {paused && screen === "play" && <section className={styles.pauseLayer} role="dialog" aria-modal="true" aria-label="Game paused"><article><small>SHIFT 01 / PAUSED</small><h2>MACHINE<br/><em>ON HOLD.</em></h2><p>The spindle is stopped and the run is preserved.</p><button className={styles.pausePrimary} onClick={() => setPaused(false)}><Play/> RESUME RUN</button><button onClick={() => { resetRun(); setMessage("Stock and process plan reset."); }}><RotateCcw/> RESTART CONTRACT</button><button onClick={() => { setPaused(false); setScreen("select"); }}><Factory/> CONTRACT INDEX</button><button onClick={() => { setPaused(false); setTourStep(0); }}><CircleHelp/> HELP / TOUR</button><footer><kbd>ESC</kbd> RESUME · <kbd>WASD</kbd> MOVE · <kbd>SPACE</kbd> SPINDLE · <kbd>I</kbd> SIGN OFF</footer></article></section>}
    {tourStep !== null && <section className={styles.tourLayer} aria-live="polite"><article className={styles.tourCard} role="dialog" aria-modal="false" aria-label="Guided game tour"><header><span>{TOUR_STEPS[tourStep].code} / 0{TOUR_STEPS.length}</span><button onClick={() => { setTourStep(null); setViewMode("map"); }} aria-label="Close guided tour"><X/></button></header><small>{TOUR_STEPS[tourStep].eyebrow}</small><h2>{TOUR_STEPS[tourStep].title}</h2><p>{TOUR_STEPS[tourStep].body}</p><div className={styles.tourProgress} aria-label={`Tour step ${tourStep + 1} of ${TOUR_STEPS.length}`}>{TOUR_STEPS.map((step, index) => <i key={step.code} data-active={index === tourStep}/>)}</div><footer><button onClick={() => { if (tourStep === 0) { setTourStep(null); setViewMode("map"); } else goToTourStep(tourStep - 1); }}>{tourStep === 0 ? "EXIT TOUR" : "PREVIOUS"}</button><b>ESC TO CLOSE</b><button className={styles.tourNext} onClick={() => goToTourStep(tourStep + 1)}>{tourStep === TOUR_STEPS.length - 1 ? "FINISH TOUR" : "NEXT AREA"}</button></footer></article></section>}
  </main>;
}

function InspectionBay({ readings, measured, selectedCharacteristic, setSelectedCharacteristic, instrument, setInstrument, measureSelected, dispositionPart, returnToCell }: {
  readings: ManualMeasurement[];
  measured: Record<string, ManualMeasurement>;
  selectedCharacteristic: string;
  setSelectedCharacteristic: (id: string) => void;
  instrument: InspectionInstrumentId;
  setInstrument: (id: InspectionInstrumentId) => void;
  measureSelected: () => void;
  dispositionPart: (decision: InspectionDisposition) => void;
  returnToCell: () => void;
}) {
  const active = readings.find((item) => item.id === selectedCharacteristic) ?? readings[0];
  const revealed = measured[active.id];
  const allMeasured = Object.keys(measured).length === readings.length;
  const instruments: Array<{ id: InspectionInstrumentId; label: string; use: string }> = [
    { id: "touch-probe", label: "Touch probe", use: "Profiles and webs" },
    { id: "bore-gauge", label: "Bore gauge", use: "Circular features" },
    { id: "profilometer", label: "Surface comparator", use: "Finish condition" },
  ];
  return <section className={styles.inspectionBay}>
    <header><div><small>QUALITY GAMEPLAY / FICTIONALIZED VALUES</small><h1>ACTIVE INSPECTION</h1><p>Select each characteristic, choose a suitable instrument, reveal the tolerance result, then accept, rework, or scrap.</p></div><button onClick={returnToCell}>← RETURN TO CELL</button></header>
    <div className={styles.inspectionGrid}>
      <aside className={styles.characteristics}><h2>01 / CHARACTERISTICS</h2>{readings.map((reading, index) => <button key={reading.id} className={active.id === reading.id ? styles.inspectionActive : ""} onClick={() => { setSelectedCharacteristic(reading.id); setInstrument(reading.instrument); }}><span>0{index + 1}</span><div><b>{reading.label}</b><small>0.000 ± {reading.tolerance.toFixed(2)} {reading.unit}</small></div><em>{measured[reading.id] ? measured[reading.id].pass ? "PASS" : "FAIL" : "OPEN"}</em></button>)}</aside>
      <article className={styles.measurementStation}><div className={styles.panelTitle}><span>02</span><div><small>MEASUREMENT PLAN</small><b>{active.label}</b></div></div><div className={styles.toleranceBand}><span>LOWER<br/><b>{(-active.tolerance).toFixed(2)}</b></span><div><i style={{ left: revealed ? `${clamp(50 + revealed.actual / active.tolerance * 46, 2, 98)}%` : "50%" }}/><em/></div><span>UPPER<br/><b>+{active.tolerance.toFixed(2)}</b></span></div><div className={styles.readout}><small>OBSERVED DEVIATION</small><strong>{revealed ? `${revealed.actual.toFixed(3)} ${revealed.unit}` : "---.---"}</strong><span className={revealed ? revealed.pass ? styles.pass : styles.fail : ""}>{revealed ? revealed.pass ? "WITHIN TOLERANCE" : "OUT OF TOLERANCE" : "NO READING"}</span></div><h3>SELECT INSTRUMENT</h3><div className={styles.instrumentGrid}>{instruments.map((item) => <button key={item.id} className={instrument === item.id ? styles.inspectionActive : ""} onClick={() => setInstrument(item.id)}><b>{item.label}</b><small>{item.use}</small></button>)}</div><button className={styles.measureButton} onClick={measureSelected}><ScanLine/> CAPTURE READING</button></article>
      <aside className={styles.findings}><h2>03 / FINDINGS</h2><div className={styles.findingList}>{readings.map((reading) => <div key={reading.id}><span>{reading.label}</span><b>{measured[reading.id] ? `${measured[reading.id].actual.toFixed(3)} / ±${reading.tolerance.toFixed(2)}` : "PENDING"}</b><em className={measured[reading.id] ? measured[reading.id].pass ? styles.pass : styles.fail : ""}>{measured[reading.id] ? measured[reading.id].pass ? "PASS" : "FAIL" : "—"}</em></div>)}</div><div className={styles.disposition}><small>FINAL DISPOSITION</small><p>{allMeasured ? "Use the evidence. An incorrect disposition is blocked and costs inspection mastery." : "All characteristics must be measured."}</p><button onClick={() => dispositionPart("accept")}>ACCEPT</button><button onClick={() => dispositionPart("rework")}>REWORK</button><button onClick={() => dispositionPart("scrap")}>SCRAP</button></div><div className={styles.safety}><ShieldCheck/><p><b>SIMULATION BOUNDARY</b>Readings use fictional SIM units and do not define a real inspection plan.</p></div></aside>
    </div>
  </section>;
}

type ShowcaseTab = "machine" | "doctrine" | "lens" | "capability" | "ladder";

function ContractSelect({ save, startContract, learningLevel, setLearningLevel }: { save: ManualSaveData; startContract: (index: number) => void; learningLevel: LearningLevel; setLearningLevel: (level: LearningLevel) => void }) {
  const lens = LEARNING_LENSES[learningLevel];
  const [showcaseTab, setShowcaseTab] = useState<ShowcaseTab>("machine");
  const selectRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const targets = selectRef.current?.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!targets?.length) return;
    const entrance = animate(targets, { opacity: { from: 0 }, y: { from: 22 }, delay: stagger(85), duration: 720, ease: "out(3)" });
    return () => entrance.cancel();
  }, []);
  return <section ref={selectRef} className={styles.select}>
    <div className={styles.selectIntro}>
      <div className={styles.heroCopy} data-reveal>
        <p>DIRECTOR DEMO / MULTI-OPERATION VERTICAL SLICE</p>
        <h1>PLAN THE CUT.<br/><em>PROVE THE QUALITY.</em></h1>
        <span>Profile, pocket, drill, and finish in order. Match each tool to the operation it is rated for, then measure the part in the inspection bay before you disposition it.</span>
        <div className={styles.heroActions}><button onClick={() => startContract(0)}><Play/> START FLAGSHIP CONTRACT</button><small>NO ACCOUNT · FICTIONAL TRAINING VALUES · KEYBOARD, MOUSE &amp; TOUCH</small></div>
      </div>
      <figure className={styles.heroVisual} data-reveal>
        <img src="/assets/keyart/toolpath-cnc-keyart-v1.webp" alt="Carbide end mill over a fixtured aluminum plate inside a vertical machining center" fetchPriority="high"/>
        <div className={styles.heroReticle} aria-hidden="true"><i/><i/><b>G54</b></div>
        <div className={styles.heroVisualIndex} aria-hidden="true"><span>01</span><b>THE CUT</b><small>CONTROLLED ENERGY / VISIBLE EVIDENCE</small></div>
        <figcaption><span>SHOP THRESHOLD / VMC CELL</span><b>6061 AL · CARBIDE · FLOOD COOLANT</b><small>KEY ART / REPRESENTATIVE GAME WORLD</small></figcaption>
      </figure>
      <dl className={styles.heroMetrics} data-reveal aria-label="Flagship experience signals"><div><dt>GEOMETRY</dt><dd>DATUM-DRIVEN</dd></div><div><dt>PROCESS</dt><dd>OPERATION-SEQUENCED</dd></div><div><dt>INSPECTION</dt><dd>EVIDENCE-GATED</dd></div><div><dt>RECOVERY</dt><dd>&lt; 3 SECOND RETRY</dd></div></dl>
    </div>
    <div className={styles.contractGrid}>{MANUAL_CONTRACTS.map((contract, index) => {
      const visual = CONTRACT_VISUALS[contract.id];
      const best = save.bests[contract.id];
      const unlocked = index === 0 || MANUAL_CONTRACTS.slice(0, index).every((item) => save.cleared.includes(item.id));
      return <button key={contract.id} data-contract={contract.id} style={{ "--card-accent": contract.color } as React.CSSProperties} onClick={() => startContract(index)}>
        <header><span>0{index + 1}</span><b>{save.cleared.includes(contract.id) ? "CLEARED" : unlocked ? "AVAILABLE" : "CHALLENGE"}</b>{best && <em style={{ color: contract.color }}>{deriveMasteryRank(best.score)} MASTERY · {best.score}</em>}</header>
        <div className={styles.geometry}><div className={styles.artifactPlate}><span>{visual.artifact}</span><b>{contract.program}</b></div><div className={styles.geometryPart}><img src={visual.image} alt="" loading="lazy"/><GeometryPreview contract={contract}/><i aria-hidden="true"/></div><div className={styles.geometryDatum} aria-hidden="true"><i/><b>G54</b><span>X0 Y0</span></div><div className={styles.geometrySpec}><span>{visual.route}</span><span>{visual.stock}</span><span>PROFILE ±{contract.tolerance}</span></div></div>
        <small>{contract.client}</small><h2>{contract.title}</h2><p>{contract.brief}</p>
        <div className={styles.contractOps}>{contract.operations.map((operation) => <span key={operation.id}>{operation.label}</span>)}</div>
        <div className={styles.processStrip}><span>MAT <b>{contract.material}</b></span><span>SURFACE <b>{visual.finish}</b></span><span>WCS <b>G54</b></span></div>
        <footer><span>{contract.par}S PAR</span><span>{contract.reward.toLocaleString()} CR</span><strong>{!unlocked ? <><LockKeyhole/> LOCKED</> : index === 0 ? "FLAGSHIP / ENTER CELL" : "ENTER CELL"} &rarr;</strong></footer>
      </button>;
    })}</div>
    <div className={styles.principles}><span><b>01</b> PLAN THE OPERATIONS</span><span><b>02</b> MATCH TOOL TO CUT</span><span><b>03</b> MEASURE BEFORE RELEASE</span></div>
    <div className={styles.publicSafety}><ShieldCheck/><span><b>SAFE PUBLIC DEMO</b>This is a creative game, not machine-operating guidance. It contains no real shop inventory, controller procedure, customer data, or production parameters.</span><ol><li><b>01</b> Start spindle</li><li><b>02</b> Sign off each operation</li><li><b>03</b> Inspect and disposition</li></ol></div>
    <section className={styles.showcaseTabs} aria-label="Machine, process, and skill reference">
      <nav aria-label="Reference section">
        <button aria-pressed={showcaseTab === "machine"} onClick={() => setShowcaseTab("machine")}>THE MACHINE</button>
        <button aria-pressed={showcaseTab === "doctrine"} onClick={() => setShowcaseTab("doctrine")}>VISUAL DOCTRINE</button>
        <button aria-pressed={showcaseTab === "lens"} onClick={() => setShowcaseTab("lens")}>LEARNING LENS</button>
        <button aria-pressed={showcaseTab === "capability"} onClick={() => setShowcaseTab("capability")}>PROCESS CAPABILITY</button>
        <button aria-pressed={showcaseTab === "ladder"} onClick={() => setShowcaseTab("ladder")}>SKILL LADDER</button>
      </nav>
      {showcaseTab === "machine" && <div className={styles.landingCell}><FlagshipMachiningKit cursor={{ x: 13.5, y: 7.5 }} spindle={false} completion={0} load={0} interactive/><section className={styles.stageAnnotations} aria-hidden="true"><span className={styles.calloutSpindle}><b>01</b> Z-AXIS / SPINDLE</span><span className={styles.calloutWork}><b>02</b> G54 / STOCK TOP</span><span className={styles.calloutFixture}><b>03</b> FIXTURE DATUM</span><i className={styles.stageCenterline}/></section><div className={styles.landingCopy}><small>PRODUCTION GEOMETRY / MACHINING KIT V1</small><h2>THE MACHINE IS<br/><em>THE STAGE.</em></h2><p>A complete open-front VMC cell surrounds the playable cut: spindle and holder, coolant manifold, vise and stock, Z bellows, cable chain, pendant, guards, chip tray, and six-slot table.</p><dl><div><dt>ENVELOPE</dt><dd>998 × 600 × 808 MM</dd></div><div><dt>STOCK</dt><dd>240 × 140 × 18 MM</dd></div><div><dt>REFERENCE</dt><dd>G54 / TOP CENTER</dd></div><div><dt>ASSET</dt><dd>11,516 TRI / 7 MAT</dd></div></dl></div></div>}
      {showcaseTab === "doctrine" && <section className={styles.metrologyDeck} aria-label="The geometry behind the machining experience"><header><small>METROLOGY / VISUAL DOCTRINE</small><h2>BEAUTY WITH<br/><em>A TOLERANCE.</em></h2><p>Every line carries a job: locate the work, communicate force, or predict the surface. Decoration is subordinate to process truth.</p></header><article><div className={styles.datumDiagram}><i/><b>G54</b><span>X0 · Y0 · Z0</span></div><small>01 / DATUM STACK</small><h3>Locate before motion.</h3><p>Orthogonal references make the setup legible at a glance and anchor every measured decision.</p><dl><div><dt>FRAME</dt><dd>3-2-1</dd></div><div><dt>ORIGIN</dt><dd>G54</dd></div></dl></article><article><div className={styles.engagementDiagram}><i/><b>ae</b><span>0–165°</span></div><small>02 / CUTTER ENGAGEMENT</small><h3>Show the force, not noise.</h3><p>The amber arc and force vector reveal radial engagement while load changes in real time.</p><dl><div><dt>VECTOR</dt><dd>Ft</dd></div><div><dt>LIMIT</dt><dd>84%</dd></div></dl></article><article><div className={styles.finishDiagram}><i/><b>Ra</b><span>µm / SIM</span></div><small>03 / SURFACE TRACE</small><h3>Make quality visible.</h3><p>Feed, cutter choice, and damage resolve into a finish estimate instead of an arbitrary glow.</p><dl><div><dt>TRACE</dt><dd>Ra</dd></div><div><dt>STATE</dt><dd>LIVE</dd></div></dl></article></section>}
      {showcaseTab === "lens" && <section className={styles.learningLens} aria-label="Choose explanation depth"><header><small>LEARNING LENS / SAME GAME, THREE DEPTHS</small><h2>HOW DEEP<br/><em>SHOULD WE GO?</em></h2><p>Change the explanation, never the challenge. Start simple and reveal the engineering when curiosity catches up.</p></header><div className={styles.lensContent}><nav aria-label="Explanation level">{(Object.keys(LEARNING_LENSES) as LearningLevel[]).map((level) => <button key={level} aria-pressed={learningLevel === level} onClick={() => { setLearningLevel(level); trackAnonymous("learning_lens_change", { level, surface: "landing" }); }}><span>{LEARNING_LENSES[level].label}</span><small>{LEARNING_LENSES[level].eyebrow}</small></button>)}</nav><article><small>{lens.eyebrow}</small><h3>{lens.title}</h3><p>{lens.summary}</p><div>{lens.concepts.map(([term, explanation], index) => <section key={term}><i>0{index + 1}</i><b>{term}</b><span>{explanation}</span></section>)}</div><footer>SELECTED LENS <b>{lens.label}</b><span>CHANGE ANYTIME INSIDE THE CELL</span></footer></article></div></section>}
      {showcaseTab === "capability" && <div className={styles.disciplineRail}><span>PROCESS CAPABILITY / FICTIONAL ARCHETYPES</span><div><i className={styles.millGlyph}/><b>3-AXIS MILLING</b><small>PROFILE · POCKET · DATUM</small></div><div><i className={styles.turnGlyph}/><b>TURNING</b><small>OD · ID · GROOVE</small></div><div><i className={styles.axisGlyph}/><b>5-AXIS</b><small>VECTOR · TILT · BLEND</small></div><div><i className={styles.edmGlyph}/><b>WIRE EDM</b><small>CONTOUR · TAPER · SKIM</small></div></div>}
      {showcaseTab === "ladder" && <ShopSkillLadder save={save}/>}
    </section>
  </section>;
}

function ShopSkillLadder({ save }: { save: ManualSaveData }) {
  const progress = deriveShopProgress(save);
  const [selectedRoleIndex, setSelectedRoleIndex] = useState(progress.currentIndex);
  const selectedRole = ROLE_LADDER[selectedRoleIndex];
  const selectedState = selectedRoleIndex < progress.currentIndex ? "COMPLETE" : selectedRoleIndex === progress.currentIndex ? "CURRENT" : "ROADMAP";
  const remainingXp = Math.max(0, selectedRole.threshold - progress.xp);
  return <section className={styles.skillLadder} aria-label="Machine shop skill progression"><header><small>SHOP SKILL RECORD / ROLE ALIGNMENT</small><h2>PROVE THE SKILL.<br/><em>CLIMB THE FLOOR.</em></h2><p>Only personal-best runs count. The ladder translates game evidence into real-shop role awareness; it does not certify employment readiness.</p><div><span>CURRENT ALIGNMENT</span><b>{progress.current.role}</b><i><em style={{ width: `${progress.progress}%` }}/></i><small>{progress.xp} VERIFIED BEST-RUN XP</small></div></header><div className={styles.skillEvidence}><span>MEASURED SKILL SIGNALS</span>{progress.skills.map((skill) => <div key={skill.label}><b>{skill.label}</b><i><em style={{ width: `${clamp(skill.value, 0, 100)}%` }}/></i><small>{skill.value}%</small></div>)}<p>Scores reflect this simulation only. Employers, schools, apprenticeships, and credentialing bodies determine real qualifications.</p></div><div className={styles.roleRail}>{ROLE_LADDER.map((role, index) => <button key={role.level} type="button" aria-pressed={selectedRoleIndex === index} aria-label={`View ${role.level} ${role.role}`} data-state={index < progress.currentIndex ? "complete" : index === progress.currentIndex ? "current" : "locked"} onClick={() => { setSelectedRoleIndex(index); trackAnonymous("skill_level_selected", { level: role.level, state: index <= progress.currentIndex ? "earned" : "roadmap" }); }}><span>{role.level}</span><small>{role.code}</small><h3>{role.role}</h3><p>{role.focus}</p><footer><b>{index <= progress.currentIndex ? "EVIDENCE MET" : role.evidence}</b><i>{index <= progress.currentIndex ? "●" : "○"}</i></footer></button>)}</div><section className={styles.roleDetail} aria-live="polite"><header><span>SELECTED PATH / {selectedRole.level}</span><b>{selectedState}</b></header><div><small>{selectedRole.code}</small><h3>{selectedRole.role}</h3><p>{selectedRole.focus}</p></div><dl><div><dt>EVIDENCE TARGET</dt><dd>{selectedRole.evidence}</dd></div><div><dt>BEST-RUN XP</dt><dd>{remainingXp ? `${remainingXp} REMAINING` : "THRESHOLD MET"}</dd></div><div><dt>ACCESS</dt><dd>EXPLORE ANY LEVEL</dd></div></dl></section><footer className={styles.careerReality}><ShieldCheck/><span><b>CAREER REALITY CHECK</b>Game performance can reveal interests and vocabulary, but cannot replace supervised shop training, safety instruction, measurement practice, credentials, or employer assessment.</span><div><a href="https://www.onetonline.org/link/summary/51-9161.00" target="_blank" rel="noreferrer">CNC OPERATOR</a><a href="https://www.onetonline.org/link/summary/51-4041.00" target="_blank" rel="noreferrer">MACHINIST</a><a href="https://www.onetonline.org/link/summary/51-9162.00" target="_blank" rel="noreferrer">CNC PROGRAMMER</a></div></footer></section>;
}

function ShopLog({ save, close }: { save: ManualSaveData; close: () => void }) {
  const [filter, setFilter] = useState<"all" | "accepted" | "rework">("all");
  const progress = deriveShopProgress(save), bestRuns = Object.values(save.bests);
  const entries = (save.log ?? []).filter((entry) => filter === "all" || (filter === "accepted" ? entry.accepted : !entry.accepted));
  const averageBest = bestRuns.length ? Math.round(bestRuns.reduce((sum, run) => sum + run.score, 0) / bestRuns.length) : 0;
  const badges = [
    { code: "M01", name: "FIRST ARTICLE", detail: "Record an inspection", earned: (save.log ?? []).length > 0 },
    { code: "M02", name: "PART RELEASE", detail: "Earn one accepted result", earned: save.cleared.length > 0 },
    { code: "M03", name: "DATUM TRIO", detail: "Release all three contracts", earned: save.cleared.length === MANUAL_CONTRACTS.length },
    { code: "M04", name: "EDGE KEEPER", detail: "Reach 28/30 precision", earned: bestRuns.some((run) => run.precision >= 28) },
    { code: "M05", name: "PROCESS WINDOW", detail: "Reach 12/14 finish", earned: bestRuns.some((run) => (run.finish ?? 0) >= 12) },
    { code: "M06", name: "S-RANK RELEASE", detail: "Score 96 or higher", earned: bestRuns.some((run) => run.score >= 96) },
  ];
  return <section className={styles.logBackdrop} role="dialog" aria-modal="true" aria-label="Shop progress log"><article className={styles.shopLog}><header><div><small>LOCAL CAREER LEDGER / DEVICE ONLY</small><h2>SHOP LOG</h2><p>Review evidence, inspect trends, and choose the next skill to improve.</p></div><button onClick={close} aria-label="Close shop log"><X/></button></header><section className={styles.logSummary}><div><span>CURRENT ALIGNMENT</span><b>{progress.current.role}</b><i><em style={{ width: `${progress.progress}%` }}/></i><small>{progress.xp} BEST-RUN XP</small></div><dl><div><dt>RELEASED</dt><dd>{save.cleared.length}/{MANUAL_CONTRACTS.length}</dd></div><div><dt>AVG BEST</dt><dd>{averageBest || "—"}</dd></div><div><dt>INSPECTIONS</dt><dd>{(save.log ?? []).length}</dd></div><div><dt>MILESTONES</dt><dd>{badges.filter((badge) => badge.earned).length}/{badges.length}</dd></div></dl></section><section className={styles.logBody}><div className={styles.logSkills}><span>SKILL SIGNALS / PERSONAL BESTS</span>{progress.skills.map((skill) => <div key={skill.label}><b>{skill.label}</b><i><em style={{ width: `${clamp(skill.value, 0, 100)}%` }}/></i><small>{skill.value}%</small></div>)}<p>{progress.next ? `NEXT FOCUS — ${progress.next.focus}` : "DEMO LADDER COMPLETE — IMPROVE CONSISTENCY"}</p></div><div className={styles.logBadges}><span>MILESTONE PLATES</span><div>{badges.map((badge) => <article key={badge.code} data-earned={badge.earned}><i>{badge.code}</i><b>{badge.name}</b><small>{badge.earned ? "EARNED" : badge.detail}</small></article>)}</div></div></section><section className={styles.runLedger}><header><div><span>INSPECTION LEDGER</span><small>LAST 24 RUNS · LOCAL ONLY</small></div><nav aria-label="Filter inspection log">{(["all","accepted","rework"] as const).map((option) => <button key={option} aria-pressed={filter === option} onClick={() => setFilter(option)}>{option.toUpperCase()}</button>)}</nav></header>{entries.length ? <div>{entries.map((entry) => <article key={entry.id} data-accepted={entry.accepted}><time dateTime={new Date(entry.at).toISOString()}>{new Date(entry.at).toLocaleDateString(undefined,{month:"short",day:"2-digit"})}</time><div><small>{entry.program}</small><b>{entry.title}</b></div><span>PROFILE <b>{entry.completion}%</b></span><span>PREC <b>{entry.precision}/30</b></span><span>CYCLE <b>{entry.elapsed}s</b></span><strong>{entry.rank}<small>{entry.score}</small></strong><i>{entry.accepted ? "RELEASED" : "REWORK"}</i></article>)}</div> : <div className={styles.emptyLog}><BookOpen/><b>NO RUNS IN THIS VIEW</b><span>Inspect a part to create the first evidence record.</span></div>}</section><footer><ShieldCheck/><span>Progress is stored on this device. It is game evidence, not certification, training completion, or an employment record.</span><button onClick={close}>RETURN TO CELL</button></footer></article></section>;
}

function GeometryPreview({ contract }: { contract: ManualContract }) {
  return <svg viewBox={`0 0 ${MILL_COLS} ${MILL_ROWS}`} aria-hidden="true">{Array.from({length:MILL_COLS*MILL_ROWS},(_,index)=>{const col=index%MILL_COLS; const row=Math.floor(index/MILL_COLS); return isManualTarget(contract.id,col,row)?<rect key={index} x={col+.08} y={row+.08} width=".84" height=".84"/>:null;})}</svg>;
}

function Meter({ icon, label, value, suffix, danger }: { icon: React.ReactNode; label: string; value: number; suffix: string; danger: boolean }) {
  return <div className={`${styles.meter} ${danger ? styles.danger : ""}`}><span>{icon}{label}</span><b>{Math.round(value)}{suffix}</b><i><em style={{ width: `${clamp(value,0,100)}%` }}/></i></div>;
}
