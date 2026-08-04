"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, Droplets, Gauge, Layers, ListTree, Pause, Play, Repeat2, RotateCcw, Route, Settings2, Sparkles, StepForward, Trophy, Wrench, Zap } from "lucide-react";
import { buildMachiningPlan, gradeMission, parseProgram, rasterize, type MachiningSetup } from "./gcode-engine";
import styles from "./gcode.module.css";

type Contract = {
  name: string;
  subtitle: string;
  client: string;
  objective: string;
  accent: string;
  xp: number;
  code: string;
};

const CONTRACTS: Contract[] = [
  {
    name: "NEON BOLT",
    subtitle: "Profile the power mark without scrapping the plate.",
    client: "VOLT MOBILITY / PROTOTYPE CELL",
    objective: "Cut the complete lightning profile below Z0. Keep waste under 12%.",
    accent: "#d8ff3e",
    xp: 650,
    code: `(CONTRACT 01 / NEON BOLT)\nG21 G90\nT1 M06\nM03 M08\nG00 X10 Y5 Z3\nG01 Z-1.8 F180\nG01 X22 Y5 F420\nG01 X15 Y17\nG01 X27 Y17\nG01 X7 Y36\nG01 X13 Y22\nG01 X2 Y22\nG01 X10 Y5\nG00 Z3\nM09 M05\nM30`,
  },
  {
    name: "ORBIT SEAL",
    subtitle: "Interpolate a clean circular seal groove.",
    client: "KESTREL AEROSPACE / FLUID SYSTEMS",
    objective: "Use clockwise arcs and one continuous cut. Radius mismatch triggers rework.",
    accent: "#ff3b8d",
    xp: 900,
    code: `(CONTRACT 02 / ORBIT SEAL)\nG21 G90\nT2 M06\nM03 M08\nG00 X30 Y20 Z4\nG01 Z-2.2 F160\nG02 X10 Y20 I-10 J0 F360\nG02 X30 Y20 I10 J0\nG00 Z4\nM09 M05\nM30`,
  },
  {
    name: "CROWN POCKET",
    subtitle: "Two depths. Five peaks. One inspection gate.",
    client: "NOCTURNE ROBOTICS / LIMITED RUN",
    objective: "Repeat the crown at a finishing depth. Earn A-rank geometry or better.",
    accent: "#55e7ff",
    xp: 1250,
    code: `(CONTRACT 03 / CROWN POCKET)\nG21 G90\nT3 M06\nM03 M08\nG00 X3 Y30 Z3\nG01 Z-1.2 F170\nG01 X3 Y10 F480\nG01 X12 Y20\nG01 X20 Y5\nG01 X28 Y20\nG01 X37 Y10\nG01 X37 Y30\nG01 X3 Y30\nG01 Z-2.8 F140\nG01 X37 Y30 F300\nG00 Z3\nM09 M05\nM30`,
  },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const DEFAULT_SETUP: MachiningSetup = { compensation: "center", finalDepth: -1.8, path: "as-programmed", passes: 1, reverse: false };

export default function GCodeStage() {
  const [contractIndex, setContractIndex] = useState(0);
  const [code, setCode] = useState(CONTRACTS[0].code);
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(1);
  const [inspected, setInspected] = useState(false);
  const [completed, setCompleted] = useState<number[]>([]);
  const [message, setMessage] = useState("Contract loaded. Review setup, then cycle start.");
  const [setup, setSetup] = useState<MachiningSetup>(DEFAULT_SETUP);
  const timer = useRef<number | null>(null);
  const contractsRef = useRef<HTMLElement>(null);
  const awardLock = useRef<string>("");
  const contract = CONTRACTS[contractIndex];
  const parsed = useMemo(() => parseProgram(code), [code]);
  const target = useMemo(() => parseProgram(contract.code), [contract.code]);
  const plan = useMemo(() => buildMachiningPlan(parsed, setup), [parsed, setup]);
  const plannedProgram = useMemo(() => ({ ...parsed, points: plan.points }), [parsed, plan.points]);
  const grade = useMemo(() => gradeMission(plannedProgram, target), [plannedProgram, target]);
  const stock = useMemo(() => rasterize(plan.points, frame), [plan.points, frame]);
  const active = plan.points[Math.min(frame - 1, plan.points.length - 1)] ?? plan.points[0];
  const progress = clamp(Math.round((frame / Math.max(1, plan.points.length)) * 100), 0, 100);
  const activeGroup = plan.groups.find((group) => frame >= group.startFrame && frame <= group.endFrame) ?? plan.groups.at(-1);
  const controllerStatus = parsed.errors.length ? "ALARM" : playing ? "RUNNING" : inspected ? "COMPLETE" : frame > 1 ? "FEED HOLD" : "READY";
  const cycleSeconds = grade.cycleSeconds * setup.passes;
  const earnedXp = completed.reduce((sum, index) => sum + CONTRACTS[index].xp, 0);

  useEffect(() => {
    try { setCompleted(JSON.parse(localStorage.getItem("toolpath-contracts") ?? "[]")); } catch { /* device-local progress is optional */ }
  }, []);

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setFrame((current) => {
        if (current >= plan.points.length) {
          setPlaying(false);
          setInspected(true);
          setMessage(grade.rank === "REWORK" ? "INSPECTION FAILED - revise the program and run again." : `INSPECTION PASSED - ${grade.rank} rank / +${contract.xp} XP.`);
          const awardKey = `${contractIndex}:${code}`;
          if (grade.rank !== "REWORK" && awardLock.current !== awardKey) {
            awardLock.current = awardKey;
            setCompleted((currentList) => {
              const next = currentList.includes(contractIndex) ? currentList : [...currentList, contractIndex];
              try { localStorage.setItem("toolpath-contracts", JSON.stringify(next)); } catch { /* optional */ }
              return next;
            });
          }
          return current;
        }
        return current + 1;
      });
    }, 34);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [code, contract.xp, contractIndex, grade.rank, plan.points.length, playing]);

  const updateSetup = (changes: Partial<MachiningSetup>, note: string) => {
    setSetup((current) => ({ ...current, ...changes })); setPlaying(false); setFrame(1); setInspected(false); setMessage(note);
  };

  const chooseContract = (index: number) => {
    setContractIndex(index);
    setCode(CONTRACTS[index].code);
    setPlaying(false);
    setFrame(1);
    setInspected(false);
    setSetup({ ...DEFAULT_SETUP, finalDepth: index === 1 ? -2.2 : index === 2 ? -2.8 : -1.8, passes: index === 2 ? 2 : 1 });
    setMessage(`${CONTRACTS[index].name} loaded. Prove the process.`);
  };

  const run = () => {
    if (parsed.errors.length) {
      setPlaying(false);
      setMessage("CONTROLLER ALARM - clear the flagged blocks before cycle start.");
      return;
    }
    if (frame >= plan.points.length) { setFrame(1); setInspected(false); }
    setPlaying((current) => !current);
    setMessage(playing ? "FEED HOLD - motion paused." : "CYCLE START - material removal live.");
  };

  const reset = () => {
    setPlaying(false);
    setFrame(1);
    setInspected(false);
    setMessage("Machine reset to safe Z. Program retained.");
  };

  const focusContracts = () => {
    contractsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => contractsRef.current?.querySelector<HTMLButtonElement>("button")?.focus(), 420);
    setMessage("CONTRACT INDEX - choose a geometry and prove the process.");
  };

  const copyRun = async () => {
    const payload = `G//CODE STAGE - ${contract.name}\n${inspected ? `RANK ${grade.rank} / SCORE ${grade.score}` : `RUN ${progress}%`}\n${setup.compensation.toUpperCase()} COMP / Z${setup.finalDepth.toFixed(2)} / ${setup.passes} PASS / ${plan.direction}\n\n${stock}\n\nI programmed this cut. #ProjectToolpath`;
    try { await navigator.clipboard.writeText(payload); setMessage("RUN CARD COPIED - the stock map is ready to share."); }
    catch { setMessage("Copy unavailable. Select the stock map to share it manually."); }
  };

  return <main className={styles.shell} style={{ "--accent": contract.accent } as React.CSSProperties}>
    <header className={styles.header}>
      <button type="button" onClick={focusContracts} className={styles.back}><ArrowLeft/> CONTRACT SELECT</button>
      <div className={styles.wordmark}><span>PROJECT TOOLPATH</span><strong>G//CODE STAGE</strong></div>
      <div className={styles.live}><i/> CELL 07 ONLINE</div>
    </header>

    <section className={styles.hero}>
      <div><p className={styles.eyebrow}>CREATIVE CNC CAMPAIGN / SHIFT 01</p><h1>WRITE<br/><em>THE CUT.</em></h1></div>
      <div className={styles.missionCard}>
        <div><span>ACTIVE CONTRACT</span><b>{contract.client}</b></div>
        <p>{contract.objective}</p>
        <footer><span><Trophy/> {earnedXp.toLocaleString()} XP</span><span>{completed.length}/3 CLEARED</span></footer>
      </div>
    </section>

    <section className={styles.theoryRail} aria-label="Simulation design system">
      <span><b>1 : 1.618</b> PHI GRID</span>
      <span><b>X / Y / Z</b> CARTESIAN FIELD</span>
      <span><b>34 MS</b> DETERMINISTIC TICK</span>
      <span><b>N + 1</b> SOURCE TRACE</span>
      <p>FORM / SYSTEM / SIGNAL</p>
    </section>

    <nav ref={contractsRef} id="contracts" className={styles.programs} aria-label="Machining contracts" tabIndex={-1}>
      {CONTRACTS.map((item, index) => <button key={item.name} className={index === contractIndex ? styles.selected : ""} onClick={() => chooseContract(index)}>
        <span>{completed.includes(index) ? <CheckCircle2/> : `0${index + 1}`}</span><div><b>{item.name}</b><small>{item.subtitle}</small></div>
      </button>)}
    </nav>

    <section className={styles.processDesk} aria-label="Machining setup and operation groups">
      <header><span><Settings2/> PROCESS SETUP</span><b>{controllerStatus}</b></header>
      <div className={styles.setupControls}>
        <fieldset><legend>CUTTER COMP</legend><div className={styles.segmented}>{(["left", "center", "right"] as const).map((value) => <button key={value} className={setup.compensation === value ? styles.controlActive : ""} onClick={() => updateSetup({ compensation: value }, `${value.toUpperCase()} COMP - ${value === "center" ? "tool center follows programmed geometry" : `.60 mm creative offset applied`}.`)}>{value === "left" ? "G41 / LEFT" : value === "right" ? "G42 / RIGHT" : "G40 / CENTER"}</button>)}</div></fieldset>
        <label className={styles.depthControl}><span>FINAL DEPTH <b>Z{setup.finalDepth.toFixed(2)} MM</b></span><input type="range" min="-5" max="-.4" step=".1" value={setup.finalDepth} onChange={(event) => updateSetup({ finalDepth: Number(event.target.value) }, `FINAL DEPTH - Z${Number(event.target.value).toFixed(2)} mm across ${setup.passes} pass${setup.passes === 1 ? "" : "es"}.`)}/></label>
        <label className={styles.selectControl}><span>MACHINING PATH</span><select value={setup.path} onChange={(event) => updateSetup({ path: event.target.value as MachiningSetup["path"] }, `${event.target.value.toUpperCase()} path strategy selected.`)}><option value="as-programmed">AS PROGRAMMED</option><option value="climb">CLIMB MILLING</option><option value="conventional">CONVENTIONAL</option></select></label>
        <fieldset><legend>MULTIPASS</legend><div className={styles.passButtons}>{[1,2,3,4,5].map((count) => <button key={count} className={setup.passes === count ? styles.controlActive : ""} onClick={() => updateSetup({ passes: count }, `${count} PASS PLAN - ${count === 1 ? "single depth" : "equal depth increments"}.`)}>{count}</button>)}</div></fieldset>
        <button className={`${styles.reverseControl} ${setup.reverse ? styles.reverseActive : ""}`} onClick={() => updateSetup({ reverse: !setup.reverse }, `${setup.reverse ? "FORWARD" : "REVERSE"} override applied to the machining path.`)}><Repeat2/><span>REVERSE PATH<b>{setup.reverse ? "OVERRIDE ON" : "FORWARD"}</b></span></button>
      </div>
      <div className={styles.groupRail}><span><ListTree/> OPERATION GROUPS</span>{plan.groups.map((group) => <button key={group.id} className={activeGroup?.id === group.id ? styles.activeGroup : ""} onClick={() => { setPlaying(false); setFrame(group.startFrame); setInspected(false); setMessage(`${group.label} - blocks ${group.sourceLines.filter(Boolean).join(", ") || "setup"}.`); }}><i>{group.kind === "cut" ? `P${group.pass}` : group.kind === "setup" ? "S" : "E"}</i><b>{group.label}</b><small>{group.endFrame - group.startFrame + 1} PTS</small></button>)}</div>
      <div className={styles.processStatus}><span><Route/> STATUS</span><dl><div><dt>MODE</dt><dd className={controllerStatus === "ALARM" ? styles.alarmStatus : ""}>{controllerStatus}</dd></div><div><dt>GROUP</dt><dd>{activeGroup?.label ?? "--"}</dd></div><div><dt>PASS</dt><dd>{activeGroup?.pass ? `${activeGroup.pass} / ${setup.passes}` : "--"}</dd></div><div><dt>DEPTHS</dt><dd>{plan.passDepths.length ? plan.passDepths.map((depth) => `Z${depth}`).join(" / ") : "--"}</dd></div><div><dt>COMP</dt><dd>{setup.compensation.toUpperCase()} / {plan.compensationMm >= 0 ? "+" : ""}{plan.compensationMm.toFixed(2)}</dd></div><div><dt>DIRECTION</dt><dd>{plan.direction}</dd></div></dl></div>
    </section>

    <section className={styles.workspace}>
      <article className={styles.editorPanel}>
        <div className={styles.panelHead}><span>FANUC-INSPIRED CREATIVE CONTROLLER / O000{contractIndex + 1}</span><span>{code.split("\n").length} BLOCKS</span></div>
        <div className={styles.editorWrap}>
          <div className={styles.lineNumbers} aria-hidden="true">{code.split("\n").map((_, index) => <span className={active?.line === index + 1 ? styles.activeLine : ""} key={index}>{String(index + 1).padStart(2, "0")}</span>)}</div>
          <textarea value={code} onChange={(event) => { setCode(event.target.value); setPlaying(false); setFrame(1); setInspected(false); setMessage("PROGRAM EDITED - run inspection to grade the revision."); }} spellCheck={false} aria-label="G-code program editor" />
        </div>
        <div className={styles.commandRail}><span><b>G00/01</b> line</span><span><b>G02/03</b> arc</span><span><b>X Y Z</b> position</span><span><b>I J</b> center</span><span><b>M03</b> spindle</span><span><b>M08</b> coolant</span></div>
      </article>

      <article className={`${styles.stagePanel} ${playing ? styles.performing : ""}`}>
        <div className={styles.panelHead}><span>STOCK REMOVAL MAP / ALUMINUM 6061</span><span>SIM {progress}%</span></div>
        <div className={styles.stage}>
          <div className={styles.halo}/><pre aria-label="ASCII stock-removal visualization">{stock}</pre>
          <div className={styles.depthReadout}><span>TOOL POSITION</span><b>X {active?.x.toFixed(2)}</b><b>Y {active?.y.toFixed(2)}</b><b className={active?.z < 0 ? styles.cuttingDepth : ""}>Z {active?.z.toFixed(2)}</b></div>
          <div className={styles.machineState}><span className={parsed.state.spindle ? styles.stateOn : ""}><Gauge/> SPINDLE</span><span className={parsed.state.coolant ? styles.stateOn : ""}><Droplets/> COOLANT</span><span><Wrench/> T{parsed.state.tool}</span></div>
          <div className={styles.beat} aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ height: `${18 + ((index * 19 + frame * 7) % 72)}%` }}/>)}</div>
        </div>
        <div className={styles.status} role="status"><Sparkles/>{message}</div>
      </article>

      <aside className={styles.scorePanel}>
        <div className={styles.panelHead}><span>QUALITY LAB</span><Trophy/></div>
        <div className={`${styles.score} ${inspected ? styles.inspected : ""}`}><span>{inspected ? "FINAL RANK" : "PROJECTED"}</span><strong>{inspected ? grade.rank : "--"}</strong><small>{inspected ? `${grade.score} / 1000` : "RUN INSPECTION"}</small></div>
        <div className={styles.meter}><span>CYCLE PROGRESS</span><b>{progress}%</b><i><em style={{ width: `${progress}%` }}/></i></div>
        <dl><div><dt>GEOMETRY</dt><dd>{grade.coverage}%</dd></div><div><dt>PRECISION</dt><dd>{grade.precision}%</dd></div><div><dt>WASTE</dt><dd className={grade.waste > 12 ? styles.error : ""}>{grade.waste}%</dd></div><div><dt>CYCLE</dt><dd>{cycleSeconds.toFixed(1)}s</dd></div></dl>
        {parsed.errors.length > 0 && <div className={styles.errors}>{parsed.errors.slice(0, 4).map((error) => <p key={error}>{error}</p>)}</div>}
        <button className={styles.copy} onClick={copyRun}><Copy/> COPY RUN CARD</button>
      </aside>
    </section>

    <section className={styles.transport}>
      <button onClick={reset} aria-label="Reset simulation"><RotateCcw/></button>
      <button className={styles.run} onClick={run}>{playing ? <Pause/> : <Play/>}<span>{playing ? "FEED HOLD" : "CYCLE START"}</span></button>
      <button onClick={() => { setPlaying(false); setFrame((value) => Math.min(plan.points.length, value + 1)); setMessage("SINGLE BLOCK - one motion, one consequence."); }} aria-label="Advance one simulation frame"><StepForward/></button>
      <div className={styles.timeline}><i style={{ width: `${progress}%` }}/></div>
      <span><Zap/> {activeGroup?.label ?? "SETUP"} / {plan.direction}</span>
    </section>

    <footer className={styles.footer}><p>CREATIVE TRAINING SIMULATION - NOT MACHINE-READY CODE OR OPERATING GUIDANCE</p><p>DETERMINISTIC KERNEL / SOURCE-LINE PROVENANCE / DEVICE-LOCAL PROGRESS</p></footer>
  </main>;
}
