"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, stagger } from "animejs";
import { Activity, Award, BookOpen, CircleGauge, Crosshair, Factory, Gauge, Hexagon, Pause, Play, RotateCcw, ScanLine, Share2, ShieldCheck, Timer, Volume2, VolumeX, Waves, Wrench, X } from "lucide-react";
import { MANUAL_CONTRACTS, MILL_COLS, MILL_ROWS, MILL_TOOLS, appendShopRunLog, createManualStock, cutManualStock, deriveShopSkillProgress, gradeManualRun, isManualTarget, manualCompletion, type ManualContract, type ShopBestRun, type ShopRunLogEntry } from "./manual-campaign-engine";
import { trackAnonymous } from "./anonymous-analytics";
import FlagshipMachiningKit from "./flagship-machining-kit";
import { shareResultCard } from "./result-card";
import styles from "./manual-campaign.module.css";
import rapidStyles from "./rapid-action.module.css";

type Screen = "select" | "play" | "result";
type LearningLevel = "easy" | "medium" | "hard";
type BestRun = ShopBestRun;
type RunLogEntry = ShopRunLogEntry;
type SaveData = { credits: number; reputation: number; cleared: string[]; bests: Record<string, BestRun>; log: RunLogEntry[] };
type Chip = { x: number; y: number; dx: number; dy: number; born: number; hot: boolean };
const DEFAULT_SAVE: SaveData = { credits: 250, reputation: 0, cleared: [], bests: {}, log: [] };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const STOCK_VIEW = { x: 80, y: 52, width: 960, height: 560 }; // 240 × 140 mm at an exact 4 px/mm drawing scale.
const LEARNING_LENSES = {
  easy: { label: "EASY", eyebrow: "FIRST CUT", title: "Keep the shape. Clear the space.", summary: "The glowing shape is the part you are saving. Silver is extra material. Start the spindle, drag through silver, and stop before the cutter touches the glow.", concepts: [["CUTTER", "The circle under your pointer removes material."], ["LOAD", "Green is comfortable. Red means pause and take a smaller bite."], ["WIN", "Clear 90% of the silver while protecting the glowing edge."]], play: "Silver goes. Glow stays. Use the smaller cutter near the edge." },
  medium: { label: "MEDIUM", eyebrow: "APPRENTICE VIEW", title: "Control engagement, not just motion.", summary: "Cutter size and radial engagement determine how much material each move removes. Open areas reward a rougher; tight profiles reward a smaller finishing tool.", concepts: [["ENGAGEMENT", "The amber arc shows how much of the cutter is buried in stock."], ["PROCESS", "Higher engagement raises simulated spindle load, heat, and finish risk."], ["STRATEGY", "Rough open stock first, then protect the profile with a precision pass."]], play: "Watch the amber engagement arc. Reduce tool size or feed near constrained geometry." },
  hard: { label: "HARD", eyebrow: "ENGINEERING VIEW", title: "Read the process window.", summary: "The simulation links feed, spindle speed, flute count, radial engagement, and finish into one consistent system. Values are fictional training data—not machine parameters.", concepts: [["CHIP LOAD", "The display derives fz = F ÷ (S × 3 flutes) from the simulated feed and RPM."], ["FORCE", "The amber Ft vector is tangential to cutter travel; its length follows simulated load."], ["QUALITY", "Profile error, remaining stock, Ra estimate, and cycle time remain separate inspection signals."]], play: "Balance fz, ae, load, and Ra. Preserve profile first; optimize cycle only inside the quality window." },
} as const;
const ROLE_LADDER = [
  { threshold: 0, level: "L0", role: "SHOP FOUNDATIONS", code: "ORIENTATION", focus: "Datum awareness · material removal · inspection loop", evidence: "Complete a measured run" },
  { threshold: 70, level: "L1", role: "CNC OPERATOR ALIGNMENT", code: "O*NET 51-9161.00", focus: "Monitor process · protect workholding · inspect output", evidence: "70 best-run XP" },
  { threshold: 165, level: "L2", role: "MACHINIST / SETUP ALIGNMENT", code: "O*NET 51-4041.00", focus: "Read geometry · select tooling · control tolerance", evidence: "165 best-run XP" },
  { threshold: 250, level: "L3", role: "CNC PROGRAMMER ALIGNMENT", code: "O*NET 51-9162.00", focus: "Plan sequence · define paths · verify simulation", evidence: "250 best-run XP" },
] as const;
const CONTRACT_VISUALS = {
  drive: { artifact: "DRIVE INTERFACE", route: "PROFILE + BORE", stock: "PLATE / 18 MM", finish: "MILL / BRUSH" },
  rib: { artifact: "LIGHTWEIGHT RIB", route: "WEBS + CONTOUR", stock: "PLATE / 22 MM", finish: "MILL / BLEND" },
  bracket: { artifact: "OPTICAL BRACKET", route: "BOSS + DATUM", stock: "BLOCK / 32 MM", finish: "MILL / SATIN" },
} as const;

function deriveShopProgress(save: SaveData) {
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
  const [screen, setScreen] = useState<Screen>("select");
  const [contractIndex, setContractIndex] = useState(0);
  const [toolIndex, setToolIndex] = useState(1);
  const [material, setMaterial] = useState(createManualStock);
  const [spindle, setSpindle] = useState(false);
  const [feed, setFeed] = useState(55);
  const [heat, setHeat] = useState(20);
  const [condition, setCondition] = useState(100);
  const [load, setLoad] = useState(0);
  const [overcut, setOvercut] = useState(0);
  const [finishPenalty, setFinishPenalty] = useState(0);
  const [breaks, setBreaks] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [cursor, setCursor] = useState({ x: 3, y: 3 });
  const [message, setMessage] = useState("Choose a contract. Geometry changes the strategy.");
  const [result, setResult] = useState<ReturnType<typeof gradeManualRun> | null>(null);
  const [previousBest, setPreviousBest] = useState<BestRun | null>(null);
  const [save, setSave] = useState<SaveData>(DEFAULT_SAVE);
  const [showCoach, setShowCoach] = useState(false);
  const [retryMs, setRetryMs] = useState<number | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [learningLevel, setLearningLevel] = useState<LearningLevel>("easy");
  const [logOpen, setLogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"map" | "twin">("map");

  const contract = MANUAL_CONTRACTS[contractIndex];
  const tool = MILL_TOOLS[toolIndex];
  const completion = useMemo(() => manualCompletion(material, contract.id), [contract.id, material]);
  const surfaceRa = clamp(.8 + finishPenalty * .42 + Math.max(0, feed - 85) * .025, .8, 12.5);
  const removalIndex = spindle ? Math.round(parseFloat(tool.diameter) * feed * Math.max(1, load) / 100) : 0;
  const machinePosition = { x: cursor.x / (MILL_COLS - 1) * 240, y: cursor.y / (MILL_ROWS - 1) * 140 };
  const spindleRpm = contract.material.includes("Ti") ? 2380 : contract.material.includes("7075") ? 6120 : 7480;
  const programmedFeed = Math.round((contract.material.includes("Ti") ? 310 : contract.material.includes("7075") ? 780 : 940) * feed / 100);
  const chipLoad = programmedFeed / Math.max(1, spindleRpm * 3);
  const engagementAngle = Math.round(clamp(load * 1.65, 0, 165));
  const shopProgress = deriveShopProgress(save);

  useEffect(() => {
    try { setSave({ ...DEFAULT_SAVE, ...JSON.parse(localStorage.getItem("toolpath-manual-campaign-v2") ?? "{}") }); } catch { /* device progress is optional */ }
    trackAnonymous("landing_view", { surface: "manual_campaign" });
  }, []);

  useEffect(() => {
    if (screen !== "play" || !spindle) return;
    const timer = window.setInterval(() => {
      setElapsed((value) => value + 1);
      setHeat((value) => clamp(value - 0.35, 18, 100));
      setLoad((value) => Math.max(0, value - 4));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen, spindle]);

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
      if (target) {
        context.strokeStyle = material[index] ? contract.color : "#ff426b"; context.lineWidth = material[index] ? 2.2 : 1.4;
        const neighbors = [[-1,0],[1,0],[0,-1],[0,1]];
        neighbors.forEach(([dx,dy], edge) => { if (!isManualTarget(contract.id, col + dx, row + dy)) { context.beginPath(); if (edge === 0) { context.moveTo(x,y); context.lineTo(x,y+ch); } if (edge === 1) { context.moveTo(x+cw,y); context.lineTo(x+cw,y+ch); } if (edge === 2) { context.moveTo(x,y); context.lineTo(x+cw,y); } if (edge === 3) { context.moveTo(x,y+ch); context.lineTo(x+cw,y+ch); } context.stroke(); } });
      }
    }

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
  }, [contract, cursor, load, material, spindle, tool.radius]);

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

  const resetRun = useCallback((nextContract = contractIndex) => {
    setContractIndex(nextContract); setMaterial(createManualStock()); setSpindle(false); setHeat(20); setCondition(100);
    setLoad(0); setOvercut(0); setFinishPenalty(0); setBreaks(0); setElapsed(0); setCursor({ x: 3, y: 3 }); setResult(null); setShareStatus(""); setViewMode("map"); firstCutTracked.current = false; toolpathRef.current = []; chipsRef.current = [];
  }, [contractIndex]);

  const retryContract = useCallback(() => {
    retryStartedAt.current = performance.now(); trackAnonymous("retry_start", { contract: contract.id });
    tone(145, .12, "triangle", .018);
    resetRun();
    setScreen("play");
    setMessage("Fresh stock loaded. Start the spindle and improve one decision.");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const measured = Math.round(performance.now() - retryStartedAt.current); setRetryMs(measured); cycleButtonRef.current?.focus();
      trackAnonymous("retry_ready", { contract: contract.id, milliseconds: measured });
    }));
  }, [contract.id, resetRun, tone]);

  const startContract = (index: number) => {
    resetRun(index); setScreen("play"); setRetryMs(null); setMessage(`${MANUAL_CONTRACTS[index].program} loaded. Select a cutter, then start the spindle.`);
    const firstRun = localStorage.getItem("toolpath-first-run-complete-v1") !== "yes"; setShowCoach(firstRun);
    trackAnonymous(index === 0 ? "flagship_start" : "cycle_start", { contract: MANUAL_CONTRACTS[index].id, entry: "contract" });
  };

  const millAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width * canvas.width, py = (clientY - rect.top) / rect.height * canvas.height;
    const x = clamp((px - STOCK_VIEW.x) / STOCK_VIEW.width * MILL_COLS - .5, 0, MILL_COLS - 1);
    const y = clamp((py - STOCK_VIEW.y) / STOCK_VIEW.height * MILL_ROWS - .5, 0, MILL_ROWS - 1);
    setCursor({ x, y });
    if (!spindle || condition <= 0) return;
    const cut = cutManualStock(material, contract.id, x, y, tool.radius);
    if (!cut.engagement) { setLoad(0); return; }
    toolpathRef.current.push({ x, y }); toolpathRef.current = toolpathRef.current.slice(-320);
    if (!firstCutTracked.current) { firstCutTracked.current = true; trackAnonymous("first_cut", { contract: contract.id, tool: tool.id, feed }); }
    const nextLoad = clamp(Math.round(cut.engagement * 7.6 * tool.load * (feed / 55)), 0, 100);
    const now = performance.now();
    for (let chip = 0; chip < Math.min(10, cut.engagement + 2); chip += 1) { const angle = (chip / Math.max(1, cut.engagement + 2)) * Math.PI * 2 + now * .002; chipsRef.current.push({ x, y, dx: Math.cos(angle) * (1.2 + chip % 3), dy: Math.sin(angle) * (1 + chip % 2), born: now, hot: nextLoad > 78 || cut.overcut > 0 }); }
    chipsRef.current = chipsRef.current.slice(-48);
    if (now - lastCutTone.current > 75) { tone(cut.overcut ? 92 : 230 + nextLoad * 2.2, .055, cut.overcut ? "sawtooth" : "square", cut.overcut ? .035 : .012); lastCutTone.current = now; }
    const heatGain = cut.engagement * .45 * tool.load * (feed / 50);
    const wear = cut.engagement * .055 * tool.wear * (1 + Math.max(0, feed - 70) / 35);
    setMaterial(cut.material); setOvercut((value) => value + cut.overcut); setLoad(nextLoad);
    setHeat((value) => clamp(value + heatGain, 18, 100));
    setCondition((value) => {
      const next = clamp(value - wear, 0, 100);
      if (next <= 0 && value > 0) { setBreaks((count) => count + 1); setSpindle(false); setMessage("TOOL FAILURE — reset the cutter and reduce engagement."); }
      return next;
    });
    setFinishPenalty((value) => value + Math.max(0, nextLoad - 82) * .018 * tool.finish + cut.overcut * .25);
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

  const inspect = () => {
    const grade = gradeManualRun(material, contract, overcut, finishPenalty, elapsed, breaks);
    const prior = save.bests[contract.id] ?? null;
    setPreviousBest(prior);
    setResult(grade); setSpindle(false); setScreen("result");
    trackAnonymous("inspection_complete", { contract: contract.id, score: grade.score, accepted: grade.accepted, completion: grade.completion, overcut });
    tone(grade.accepted ? 660 : 105, grade.accepted ? .24 : .3, grade.accepted ? "sine" : "sawtooth", .04);
    setMessage(grade.accepted ? `PART ACCEPTED — ${grade.rank} rank.` : "INSPECTION HOLD — clear more stock without touching the part.");
    setSave((current) => {
      const firstClear = grade.accepted && !current.cleared.includes(contract.id);
      const bests = grade.accepted && (!current.bests[contract.id] || grade.score > current.bests[contract.id].score)
        ? { ...current.bests, [contract.id]: { score: grade.score, precision: grade.precision, completion: grade.completion, elapsed, geometry: grade.geometry, finish: grade.finish, time: grade.time } }
        : current.bests;
      const now = Date.now();
      const entry: RunLogEntry = { id: `${now}-${contract.id}`, contract: contract.id, program: contract.program, title: contract.title, score: grade.score, rank: grade.rank, accepted: grade.accepted, completion: grade.completion, precision: grade.precision, finish: grade.finish, elapsed, overcut, at: now };
      const next: SaveData = { credits: current.credits + (grade.accepted ? firstClear ? grade.payout : Math.round(grade.payout * .2) : 0), reputation: current.reputation + (firstClear ? grade.score : 0), cleared: firstClear ? [...current.cleared, contract.id] : current.cleared, bests, log: appendShopRunLog(current.log ?? [], entry) };
      try { localStorage.setItem("toolpath-manual-campaign-v2", JSON.stringify(next)); } catch { /* optional */ }
      return next;
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (screen !== "result") return;
      if (event.key.toLowerCase() === "r") { event.preventDefault(); retryContract(); }
      if (event.code === "Space") {
        event.preventDefault();
        if (result?.accepted && contractIndex < MANUAL_CONTRACTS.length - 1) startContract(contractIndex + 1);
        else retryContract();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contractIndex, result?.accepted, retryContract, screen]);

  const restoreTool = () => { setCondition(100); setHeat(25); setSpindle(false); setMessage("Fresh cutter loaded. Verify offset before restart."); };
  const inspectionBands = result ? [
    { label: "PROFILE", value: result.precision / 30 * 100, reading: `${overcut}/${contract.tolerance} CELLS` },
    { label: "MATERIAL", value: result.completion, reading: `${result.completion}% CLEAR` },
    { label: "SURFACE", value: result.finish / 14 * 100, reading: `Ra ${surfaceRa.toFixed(1)} µm` },
    { label: "CYCLE", value: result.time / 10 * 100, reading: `${elapsed}/${contract.par} SEC` },
  ] : [];

  return <main className={styles.shell} style={{ "--accent": contract.color } as React.CSSProperties}>
    <header className={styles.header}>
      <div className={styles.brand}><Factory/><span>PROJECT TOOLPATH</span><strong>MANUAL MILL // CELL 01</strong></div>
      <div className={styles.shift}><i/> CREATIVE MACHINING LAB <b>SHIFT 01</b></div>
      <div className={styles.profile}><span>REP <b>{save.reputation}</b></span><span>CREDITS <b>{save.credits.toLocaleString()}</b></span><button className={styles.shopLogButton} onClick={() => { setLogOpen(true); trackAnonymous("shop_log_open", { surface: screen }); }}><BookOpen/> SHOP LOG</button><button className={styles.soundToggle} onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? "Mute game audio" : "Enable game audio"}>{soundOn ? <Volume2/> : <VolumeX/>}</button></div>
    </header>

    {screen === "select" ? <ContractSelect save={save} startContract={startContract} learningLevel={learningLevel} setLearningLevel={setLearningLevel}/> : <>
      <section className={styles.jobbar}>
        <button onClick={() => { setSpindle(false); setScreen("select"); }}>&larr; CONTRACT INDEX</button>
        <div><small>{contract.client} / {contract.program}</small><b>{contract.title}</b></div>
        <div className={styles.jobstats}><span>MAT <b>{contract.material}</b></span><span>PAR <b>{contract.par}s</b></span><span>TOL <b>{contract.tolerance} cells</b></span></div>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.setup}>
          <div className={styles.panelTitle}><span>01</span><div><small>PROCESS SETUP</small><b>Choose your edge</b></div></div>
          <div className={styles.toolList}>{MILL_TOOLS.map((item, index) => <button key={item.id} disabled={spindle} className={index === toolIndex ? styles.activeTool : ""} onClick={() => { setToolIndex(index); setMessage(`${item.name} selected — ${item.role.toLowerCase()}.`); }}>
            <span>T{item.id}</span><div><b>{item.name}</b><small>{item.diameter} / {item.role}</small></div><em>{item.radius.toFixed(2)}R</em>
          </button>)}</div>
          <label className={styles.feed}><span>FEED OVERRIDE <b>{feed}%</b></span><input type="range" min="25" max="115" value={feed} onChange={(event) => setFeed(Number(event.target.value))}/></label>
          <div className={styles.strategy}><Hexagon/><p><b>PROCESS NOTE</b>{tool.role}. Larger cutters remove stock faster, but load more cells and cannot resolve tight geometry.</p></div>
          <div className={styles.cellLearning}><span>EXPLANATION DEPTH</span><div>{(Object.keys(LEARNING_LENSES) as LearningLevel[]).map((level) => <button key={level} aria-pressed={learningLevel === level} onClick={() => { setLearningLevel(level); trackAnonymous("learning_lens_change", { level, surface: "machine" }); }}>{LEARNING_LENSES[level].label}</button>)}</div><p><b>{LEARNING_LENSES[learningLevel].eyebrow}</b>{LEARNING_LENSES[learningLevel].play}</p></div>
          <button className={styles.reset} onClick={() => { resetRun(); setMessage("Stock reset. Setup retained."); }}><RotateCcw/> RESET STOCK</button>
        </aside>

        <article className={styles.machine}>
          <div className={styles.machineHead}><span><i/> VMC-01 / THREE-AXIS TRAINING CELL</span><span>G54 / 240 × 140 × 18 MM</span><div className={styles.viewSwitch} aria-label="Machine viewport mode"><button aria-pressed={viewMode === "map"} onClick={() => setViewMode("map")}>CUT MAP</button><button aria-pressed={viewMode === "twin"} onClick={() => { setSpindle(false); setLoad(0); setViewMode("twin"); setMessage("3D TWIN — spindle held at safe Z for visual review."); trackAnonymous("view_3d_twin", { contract: contract.id, completion }); }}>3D TWIN</button></div><span>PROGRAM <b>{contract.program}</b></span></div>
          <div className={styles.viewport}>
            <canvas ref={canvasRef} width={1120} height={640} aria-label="Interactive milling stock" onPointerDown={(event) => { dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); millAt(event.clientX, event.clientY); }} onPointerMove={(event) => dragging.current ? millAt(event.clientX, event.clientY) : moveCursor(event.clientX, event.clientY)} onPointerUp={() => { dragging.current = false; setLoad(0); }} onPointerCancel={() => { dragging.current = false; setLoad(0); }}/>
            <div className={styles.coordinates}><small>G54 POSITION / MM</small><b>X {machinePosition.x.toFixed(2)}</b><b>Y {machinePosition.y.toFixed(2)}</b><b>Z {spindle ? "-1.80" : "+4.00"}</b></div>
            <div className={styles.processPlate}><small>PROCESS ESTIMATE / SIM</small><span><b>S</b>{spindleRpm.toLocaleString()} RPM</span><span><b>F</b>{programmedFeed} MM/MIN</span><span><b>fz</b>{chipLoad.toFixed(3)} MM</span><span><b>ae</b>{engagementAngle}°</span><span><b>Ra</b>{surfaceRa.toFixed(1)} µm</span><span><b>MRR</b>{removalIndex}</span><span><b>WCS</b>G54</span><span><b>PATH</b>{tool.role.includes("Precision") ? "FINISH" : "ADAPTIVE"}</span></div>
            <div className={styles.legend}><span><i className={styles.keep}/> PART</span><span><i className={styles.waste}/> REMOVE</span><span><i className={styles.damage}/> OVERCUT</span></div>
            {!spindle && <div className={styles.prompt}><Crosshair/><b>{completion ? "SPINDLE PAUSED" : "SET YOUR CUT"}</b><span>Drag across the stock after cycle start.</span></div>}
            {contract.id === "drive" && <FlagshipMachiningKit cursor={cursor} spindle={spindle} completion={completion} load={load}/>}
            {viewMode === "twin" && <section className={styles.twinReview} aria-label="Full-frame 3D machining twin review"><FlagshipMachiningKit cursor={cursor} spindle={false} completion={completion} load={load} variant="full"/><div className={styles.twinTitle}><small>DIGITAL TWIN / VISUAL REVIEW</small><b>FIXTURE + TOOL + STOCK</b><span>LIVE GLB / SAFE Z</span></div><div className={styles.twinCoordinates}><span>X <b>{machinePosition.x.toFixed(2)}</b></span><span>Y <b>{machinePosition.y.toFixed(2)}</b></span><span>Z <b>+4.00</b></span><small>G54 / MM</small></div><div className={styles.twinProgress}><span>STOCK REMOVAL</span><strong>{completion}%</strong><i><em style={{ width: `${completion}%` }}/></i><div><small>TOOL</small><b>T{tool.id} / {tool.diameter}</b><small>FIXTURE</small><b>VISE / PARALLELS</b><small>STATE</small><b>REVIEW HOLD</b></div></div><div className={styles.twinCallouts} aria-hidden="true"><span className={styles.twinSpindle}>01 / SPINDLE BODY</span><span className={styles.twinTool}>02 / CUTTER CENTER</span><span className={styles.twinStock}>03 / STOCK ENVELOPE</span><span className={styles.twinFixture}>04 / FIXTURE STACK</span></div><button className={styles.returnMap} onClick={() => { setViewMode("map"); setMessage("CUT MAP ACTIVE — resume from the recorded tool position."); }}>RETURN TO CUT MAP <Crosshair/></button></section>}
            {showCoach && <div className={styles.coach} role="dialog" aria-label="First run briefing"><small>FIRST CUT / 20 SECONDS</small><b>SILVER GOES. CYAN STAYS.</b><ol><li>Press cycle start.</li><li>Drag through silver stock.</li><li>Inspect at 90% or better.</li></ol><button onClick={() => { localStorage.setItem("toolpath-first-run-complete-v1", "yes"); setShowCoach(false); cycleButtonRef.current?.focus(); }}>I&apos;M READY</button></div>}
          </div>
          <div className={styles.controls}>
            <button ref={cycleButtonRef} className={spindle ? styles.hold : styles.start} onClick={() => { if (viewMode === "twin") { setViewMode("map"); setMessage("CUT MAP ACTIVE — verify position, then start the cycle."); return; } if (condition <= 0) { restoreTool(); return; } if (!spindle) { trackAnonymous("cycle_start", { contract: contract.id, feed, tool: tool.id }); tone(185, .14, "triangle", .032); window.setTimeout(() => tone(310, .09, "sine", .018), 70); } else tone(120, .09, "triangle", .018); setSpindle((value) => !value); setMessage(spindle ? "FEED HOLD — spindle stopped." : "SPINDLE LIVE — trace the waste field."); }}>{spindle ? <Pause/> : <Play/>}<span>{viewMode === "twin" ? "RETURN TO MAP" : spindle ? "FEED HOLD" : condition <= 0 ? "CHANGE TOOL" : "CYCLE START"}</span></button>
            <div className={styles.timeline}><i style={{ width: `${completion}%` }}/><span>{completion}% REMOVED</span></div>
            <button className={styles.inspect} onClick={inspect}><ScanLine/> INSPECT PART</button>
          </div>
          <div className={styles.message} role="status"><Activity/>{message}{retryMs !== null && <b className={retryMs < 3000 ? styles.readyFast : styles.readySlow}>RESET READY {retryMs}MS</b>}</div>
        </article>

        <aside className={styles.telemetry}>
          <div className={styles.panelTitle}><span>02</span><div><small>LIVE TELEMETRY</small><b>Process window</b></div></div>
          <div className={styles.completion}><CircleGauge/><strong>{completion}%</strong><span>PROFILE</span></div>
          <Meter icon={<Gauge/>} label="SPINDLE LOAD" value={load} suffix="%" danger={load > 84}/>
          <Meter icon={<Activity/>} label="TOOL HEAT" value={heat} suffix="°C" danger={heat > 78}/>
          <Meter icon={<Wrench/>} label="TOOL CONDITION" value={condition} suffix="%" danger={condition < 24}/>
          <div className={styles.coolant}><Waves/><span><b>COOLANT FIELD</b>{spindle ? "ACTIVE / CHIP EVACUATION" : "STANDBY / SAFE Z"}</span><i className={spindle ? styles.coolantLive : ""}/></div>
          <dl><div><dt>ELAPSED</dt><dd>{String(Math.floor(elapsed/60)).padStart(2,"0")}:{String(elapsed%60).padStart(2,"0")}</dd></div><div><dt>OVERCUT CELLS</dt><dd className={overcut > contract.tolerance ? styles.bad : ""}>{overcut}</dd></div><div><dt>SURFACE EST.</dt><dd>Ra {surfaceRa.toFixed(1)} µm</dd></div><div><dt>SPINDLE / SIM</dt><dd>{spindleRpm.toLocaleString()} RPM</dd></div><div><dt>FEED / SIM</dt><dd>{programmedFeed} MM/MIN</dd></div><div><dt>CHIP LOAD / SIM</dt><dd>{chipLoad.toFixed(3)} MM</dd></div><div><dt>ENGAGEMENT</dt><dd>{engagementAngle}°</dd></div><div><dt>TOOL</dt><dd>T{tool.id} / {tool.diameter}</dd></div><div><dt>WORK OFFSET</dt><dd>G54</dd></div></dl>
          <div className={styles.safety}><ShieldCheck/><p><b>CREATIVE SIMULATION</b>Not machine-operating guidance. Never transfer game values to physical equipment.</p></div>
        </aside>
      </section>
    </>}

    {screen === "result" && result && <section className={styles.resultBackdrop}>
      <article className={styles.resultCard} data-verdict={result.accepted ? "accepted" : "hold"}>
        <div className={styles.resultHero}><div className={styles.rank}><Award/><span>{result.accepted ? "INSPECTION ACCEPTED" : "INSPECTION HOLD"}</span><strong>{result.rank}</strong><small>{result.score} / 100</small></div><section className={styles.inspectionMap} aria-label="Simulated dimensional inspection visualization"><header><span>CMM PROFILE REPORT / SIM</span><b>{contract.program}</b><i>{result.accepted ? "RELEASE" : "REWORK"}</i></header><div className={styles.inspectionGeometry}><GeometryPreview contract={contract}/><i className={styles.inspectionX}/><i className={styles.inspectionY}/><span>G54</span><b>PROFILE TRACE<br/>240 × 140 MM FIELD</b></div><div className={styles.deviationBands}>{inspectionBands.map((band) => <div key={band.label}><span>{band.label}</span><i><em style={{ width: `${clamp(band.value, 0, 100)}%` }}/></i><b>{band.reading}</b></div>)}</div><footer><span>MAT <b>{contract.material}</b></span><span>WCS <b>G54</b></span><span>TOOL <b>T{tool.id}</b></span><span>TRACE <b>{result.accepted ? "IN BAND" : "OUT OF BAND"}</b></span></footer></section></div>
        <div className={styles.resultData}><div><span>GEOMETRY</span><b>{result.geometry}/46</b><small>{result.completion}% waste cleared</small></div><div><span>PRECISION</span><b>{result.precision}/30</b><small>{overcut}/{contract.tolerance} overcut cells</small></div><div><span>FINISH</span><b>{result.finish}/14</b><small>{finishPenalty.toFixed(1)} risk index</small></div><div><span>CYCLE</span><b>{result.time}/10</b><small>{elapsed}s / {contract.par}s par</small></div></div>
        <div className={styles.scoreProof}><span>SCORE PROOF</span><code>{result.geometry} + {result.precision} + {result.finish} + {result.time} − {result.breakPenalty} = <b>{result.score}</b></code><i>{result.completion >= 90 ? "✓" : "×"} COMPLETION ≥90%</i><i>{overcut <= contract.tolerance ? "✓" : "×"} OVERCUT ≤{contract.tolerance}</i></div>
        <p>{result.accepted ? `Released to ${contract.client}. ${result.payout.toLocaleString()} credits earned.` : `Remove at least 90% of the waste and stay within ${contract.tolerance} overcut cells.`}</p>
        <div className={rapidStyles.improvement}><b>{previousBest ? `${result.score >= previousBest.score ? "+" : ""}${result.score - previousBest.score} VS PERSONAL BEST` : "FIRST VALID RESULT SETS YOUR BENCHMARK"}</b><span>{result.accepted ? (result.precision < 26 ? "Next run: protect the glowing part edge more carefully." : result.completion < 98 ? "Next run: clear the remaining silver stock." : "Next run: preserve quality with a shorter path.") : "Fastest recovery: retry fresh stock, then cut only the silver field."}</span></div>
        <div className={styles.careerPulse}><span>SHOP SKILL RECORD</span><b>{shopProgress.current.role}</b><button onClick={() => setLogOpen(true)}>REVIEW LOG <BookOpen/></button><i><em style={{ width: `${shopProgress.progress}%` }}/></i><small>{shopProgress.next ? `${Math.max(0, shopProgress.next.threshold - shopProgress.xp)} BEST-RUN XP TO ${shopProgress.next.role}` : "CURRENT DEMO LADDER COMPLETE"}</small></div>
        {shareStatus && <div className={styles.shareStatus} role="status">{shareStatus}</div>}
        <div className={`${styles.resultActions} ${rapidStyles.actions}`}><button onClick={async () => { try { const status = await shareResultCard({ contract: contract.title, program: contract.program, rank: result.rank, score: result.score, accepted: result.accepted, geometry: result.geometry, precision: result.precision, finish: result.finish, time: result.time, personalBestDelta: previousBest ? result.score - previousBest.score : null }); setShareStatus(status); trackAnonymous("result_share", { contract: contract.id, score: result.score }); } catch { setShareStatus("SHARE CANCELLED — RESULT KEPT"); } }}><Share2/> SHARE RESULT CARD</button><button onClick={retryContract}>RETRY FOR BETTER SCORE <kbd>R</kbd></button><button className={styles.primary} onClick={() => result.accepted && contractIndex < MANUAL_CONTRACTS.length - 1 ? startContract(contractIndex + 1) : result.accepted ? setScreen("select") : retryContract()}>{result.accepted ? contractIndex < 2 ? "START NEXT CONTRACT" : "CAMPAIGN INDEX" : "RETRY NOW"} <kbd>SPACE</kbd></button></div>
      </article>
    </section>}
    {logOpen && <ShopLog save={save} close={() => setLogOpen(false)}/>}
  </main>;
}

function ContractSelect({ save, startContract, learningLevel, setLearningLevel }: { save: SaveData; startContract: (index: number) => void; learningLevel: LearningLevel; setLearningLevel: (level: LearningLevel) => void }) {
  const lens = LEARNING_LENSES[learningLevel];
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
        <p>DIRECTOR DEMO / 90-SECOND VERTICAL SLICE</p>
        <h1>MAKE THE PART.<br/><em>PROTECT THE EDGE.</em></h1>
        <span>Remove the silver stock. Keep the glowing part untouched. One flagship contract proves the complete learn–cut–inspect–improve loop.</span>
        <div className={styles.heroActions}><button onClick={() => startContract(0)}><Play/> START FLAGSHIP CONTRACT</button><small>NO ACCOUNT · FICTIONAL TRAINING VALUES · KEYBOARD, MOUSE &amp; TOUCH</small></div>
      </div>
      <figure className={styles.heroVisual} data-reveal>
        <img src="/assets/keyart/toolpath-cnc-keyart-v1.webp" alt="Carbide end mill over a fixtured aluminum plate inside a vertical machining center" fetchPriority="high"/>
        <div className={styles.heroReticle} aria-hidden="true"><i/><i/><b>G54</b></div>
        <div className={styles.heroVisualIndex} aria-hidden="true"><span>01</span><b>THE CUT</b><small>CONTROLLED ENERGY / VISIBLE EVIDENCE</small></div>
        <figcaption><span>SHOP THRESHOLD / VMC CELL</span><b>6061 AL · CARBIDE · FLOOD COOLANT</b><small>KEY ART / REPRESENTATIVE GAME WORLD</small></figcaption>
      </figure>
      <dl className={styles.heroMetrics} data-reveal aria-label="Flagship experience signals"><div><dt>GEOMETRY</dt><dd>DATUM-DRIVEN</dd></div><div><dt>PROCESS</dt><dd>LOAD-RESPONSIVE</dd></div><div><dt>INSPECTION</dt><dd>SCORE-PROVEN</dd></div><div><dt>RECOVERY</dt><dd>&lt; 3 SECOND RETRY</dd></div></dl>
    </div>
    <div className={styles.landingCell}><FlagshipMachiningKit cursor={{ x: 13.5, y: 7.5 }} spindle={false} completion={0} load={0}/><section className={styles.stageAnnotations} aria-hidden="true"><span className={styles.calloutSpindle}><b>01</b> Z-AXIS / SPINDLE</span><span className={styles.calloutWork}><b>02</b> G54 / STOCK TOP</span><span className={styles.calloutFixture}><b>03</b> FIXTURE DATUM</span><i className={styles.stageCenterline}/></section><div className={styles.landingCopy}><small>PRODUCTION GEOMETRY / MACHINING KIT V1</small><h2>THE MACHINE IS<br/><em>THE STAGE.</em></h2><p>A modeled spindle, 10 mm flat end mill, vise, moving jaw, stock datum, and T-slot table establish the physical language before the first cut.</p><dl><div><dt>ENVELOPE</dt><dd>680 × 460 × 570 MM</dd></div><div><dt>STOCK</dt><dd>240 × 140 × 18 MM</dd></div><div><dt>REFERENCE</dt><dd>G54 / TOP CENTER</dd></div><div><dt>ASSET</dt><dd>2,012 TRI / 6 MAT</dd></div></dl></div></div>
    <section className={styles.metrologyDeck} aria-label="The geometry behind the machining experience"><header><small>METROLOGY / VISUAL DOCTRINE</small><h2>BEAUTY WITH<br/><em>A TOLERANCE.</em></h2><p>Every line carries a job: locate the work, communicate force, or predict the surface. Decoration is subordinate to process truth.</p></header><article><div className={styles.datumDiagram}><i/><b>G54</b><span>X0 · Y0 · Z0</span></div><small>01 / DATUM STACK</small><h3>Locate before motion.</h3><p>Orthogonal references make the setup legible at a glance and anchor every measured decision.</p><dl><div><dt>FRAME</dt><dd>3-2-1</dd></div><div><dt>ORIGIN</dt><dd>G54</dd></div></dl></article><article><div className={styles.engagementDiagram}><i/><b>ae</b><span>0–165°</span></div><small>02 / CUTTER ENGAGEMENT</small><h3>Show the force, not noise.</h3><p>The amber arc and force vector reveal radial engagement while load changes in real time.</p><dl><div><dt>VECTOR</dt><dd>Ft</dd></div><div><dt>LIMIT</dt><dd>84%</dd></div></dl></article><article><div className={styles.finishDiagram}><i/><b>Ra</b><span>µm / SIM</span></div><small>03 / SURFACE TRACE</small><h3>Make quality visible.</h3><p>Feed, cutter choice, and damage resolve into a finish estimate instead of an arbitrary glow.</p><dl><div><dt>TRACE</dt><dd>Ra</dd></div><div><dt>STATE</dt><dd>LIVE</dd></div></dl></article></section>
    <div className={styles.publicSafety}><ShieldCheck/><span><b>SAFE PUBLIC DEMO</b>This is a creative game, not machine-operating guidance. It contains no real shop inventory, controller procedure, customer data, or production parameters.</span><ol><li><b>01</b> Start spindle</li><li><b>02</b> Cut silver</li><li><b>03</b> Inspect at 90%</li></ol></div>
    <section className={styles.learningLens} aria-label="Choose explanation depth"><header><small>LEARNING LENS / SAME GAME, THREE DEPTHS</small><h2>HOW DEEP<br/><em>SHOULD WE GO?</em></h2><p>Change the explanation, never the challenge. Start simple and reveal the engineering when curiosity catches up.</p></header><div className={styles.lensContent}><nav aria-label="Explanation level">{(Object.keys(LEARNING_LENSES) as LearningLevel[]).map((level) => <button key={level} aria-pressed={learningLevel === level} onClick={() => { setLearningLevel(level); trackAnonymous("learning_lens_change", { level, surface: "landing" }); }}><span>{LEARNING_LENSES[level].label}</span><small>{LEARNING_LENSES[level].eyebrow}</small></button>)}</nav><article><small>{lens.eyebrow}</small><h3>{lens.title}</h3><p>{lens.summary}</p><div>{lens.concepts.map(([term, explanation], index) => <section key={term}><i>0{index + 1}</i><b>{term}</b><span>{explanation}</span></section>)}</div><footer>SELECTED LENS <b>{lens.label}</b><span>CHANGE ANYTIME INSIDE THE CELL</span></footer></article></div></section>
    <ShopSkillLadder save={save}/>
    <div className={styles.disciplineRail}><span>PROCESS CAPABILITY / FICTIONAL ARCHETYPES</span><div><i className={styles.millGlyph}/><b>3-AXIS MILLING</b><small>PROFILE · POCKET · DATUM</small></div><div><i className={styles.turnGlyph}/><b>TURNING</b><small>OD · ID · GROOVE</small></div><div><i className={styles.axisGlyph}/><b>5-AXIS</b><small>VECTOR · TILT · BLEND</small></div><div><i className={styles.edmGlyph}/><b>WIRE EDM</b><small>CONTOUR · TAPER · SKIM</small></div></div>
    <div className={styles.contractGrid}>{MANUAL_CONTRACTS.map((contract, index) => {
      const visual = CONTRACT_VISUALS[contract.id];
      return <button key={contract.id} data-contract={contract.id} style={{ "--card-accent": contract.color } as React.CSSProperties} onClick={() => startContract(index)}>
        <header><span>0{index + 1}</span><b>{save.cleared.includes(contract.id) ? "CLEARED" : index === 0 || save.cleared.length >= index ? "AVAILABLE" : "CHALLENGE"}</b></header>
        <div className={styles.geometry}><div className={styles.artifactPlate}><span>{visual.artifact}</span><b>{contract.program}</b></div><div className={styles.geometryPart}><GeometryPreview contract={contract}/><i aria-hidden="true"/></div><div className={styles.geometryDatum} aria-hidden="true"><i/><b>G54</b><span>X0 Y0</span></div><div className={styles.geometrySpec}><span>{visual.route}</span><span>{visual.stock}</span><span>PROFILE ±{contract.tolerance}</span></div></div>
        <small>{contract.client}</small><h2>{contract.title}</h2><p>{contract.brief}</p>
        <div className={styles.processStrip}><span>MAT <b>{contract.material}</b></span><span>SURFACE <b>{visual.finish}</b></span><span>WCS <b>G54</b></span></div>
        <footer><span>{contract.par}S PAR</span><span>{contract.reward.toLocaleString()} CR</span><strong>{index === 0 ? "FLAGSHIP / ENTER CELL" : "ENTER CELL"} &rarr;</strong></footer>
      </button>;
    })}</div>
    <div className={styles.principles}><span><b>01</b> GEOMETRY IS THE BRIEF</span><span><b>02</b> ENGAGEMENT IS THE RISK</span><span><b>03</b> INSPECTION IS THE TRUTH</span></div>
  </section>;
}

function ShopSkillLadder({ save }: { save: SaveData }) {
  const progress = deriveShopProgress(save);
  return <section className={styles.skillLadder} aria-label="Machine shop skill progression"><header><small>SHOP SKILL RECORD / ROLE ALIGNMENT</small><h2>PROVE THE SKILL.<br/><em>CLIMB THE FLOOR.</em></h2><p>Only personal-best runs count. The ladder translates game evidence into real-shop role awareness; it does not certify employment readiness.</p><div><span>CURRENT ALIGNMENT</span><b>{progress.current.role}</b><i><em style={{ width: `${progress.progress}%` }}/></i><small>{progress.xp} VERIFIED BEST-RUN XP</small></div></header><div className={styles.skillEvidence}><span>MEASURED SKILL SIGNALS</span>{progress.skills.map((skill) => <div key={skill.label}><b>{skill.label}</b><i><em style={{ width: `${clamp(skill.value, 0, 100)}%` }}/></i><small>{skill.value}%</small></div>)}<p>Scores reflect this simulation only. Employers, schools, apprenticeships, and credentialing bodies determine real qualifications.</p></div><div className={styles.roleRail}>{ROLE_LADDER.map((role, index) => <article key={role.level} data-state={index < progress.currentIndex ? "complete" : index === progress.currentIndex ? "current" : "locked"}><span>{role.level}</span><small>{role.code}</small><h3>{role.role}</h3><p>{role.focus}</p><footer><b>{index <= progress.currentIndex ? "EVIDENCE MET" : role.evidence}</b><i>{index <= progress.currentIndex ? "●" : "○"}</i></footer></article>)}</div><footer className={styles.careerReality}><ShieldCheck/><span><b>CAREER REALITY CHECK</b>Game performance can reveal interests and vocabulary, but cannot replace supervised shop training, safety instruction, measurement practice, credentials, or employer assessment.</span><div><a href="https://www.onetonline.org/link/summary/51-9161.00" target="_blank" rel="noreferrer">CNC OPERATOR</a><a href="https://www.onetonline.org/link/summary/51-4041.00" target="_blank" rel="noreferrer">MACHINIST</a><a href="https://www.onetonline.org/link/summary/51-9162.00" target="_blank" rel="noreferrer">CNC PROGRAMMER</a></div></footer></section>;
}

function ShopLog({ save, close }: { save: SaveData; close: () => void }) {
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
