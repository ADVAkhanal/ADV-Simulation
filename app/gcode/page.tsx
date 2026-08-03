"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Copy, Droplets, Gauge, Pause, Play, RotateCcw, Sparkles, StepForward, Trophy, Wrench, Zap } from "lucide-react";
import { gradeMission, parseProgram, rasterize } from "./gcode-engine";
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

export default function GCodeStage() {
  const [contractIndex, setContractIndex] = useState(0);
  const [code, setCode] = useState(CONTRACTS[0].code);
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(1);
  const [inspected, setInspected] = useState(false);
  const [completed, setCompleted] = useState<number[]>([]);
  const [message, setMessage] = useState("Contract loaded. Review setup, then cycle start.");
  const timer = useRef<number | null>(null);
  const awardLock = useRef<string>("");
  const contract = CONTRACTS[contractIndex];
  const parsed = useMemo(() => parseProgram(code), [code]);
  const target = useMemo(() => parseProgram(contract.code), [contract.code]);
  const grade = useMemo(() => gradeMission(parsed, target), [parsed, target]);
  const stock = useMemo(() => rasterize(parsed.points, frame), [parsed.points, frame]);
  const active = parsed.points[Math.min(frame - 1, parsed.points.length - 1)] ?? parsed.points[0];
  const progress = clamp(Math.round((frame / Math.max(1, parsed.points.length)) * 100), 0, 100);
  const earnedXp = completed.reduce((sum, index) => sum + CONTRACTS[index].xp, 0);

  useEffect(() => {
    try { setCompleted(JSON.parse(localStorage.getItem("toolpath-contracts") ?? "[]")); } catch { /* device-local progress is optional */ }
  }, []);

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setFrame((current) => {
        if (current >= parsed.points.length) {
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
  }, [code, contract.xp, contractIndex, grade.rank, parsed.points.length, playing]);

  const chooseContract = (index: number) => {
    setContractIndex(index);
    setCode(CONTRACTS[index].code);
    setPlaying(false);
    setFrame(1);
    setInspected(false);
    setMessage(`${CONTRACTS[index].name} loaded. Prove the process.`);
  };

  const run = () => {
    if (parsed.errors.length) {
      setPlaying(false);
      setMessage("CONTROLLER ALARM - clear the flagged blocks before cycle start.");
      return;
    }
    if (frame >= parsed.points.length) { setFrame(1); setInspected(false); }
    setPlaying((current) => !current);
    setMessage(playing ? "FEED HOLD - motion paused." : "CYCLE START - material removal live.");
  };

  const reset = () => {
    setPlaying(false);
    setFrame(1);
    setInspected(false);
    setMessage("Machine reset to safe Z. Program retained.");
  };

  const copyRun = async () => {
    const payload = `G//CODE STAGE - ${contract.name}\n${inspected ? `RANK ${grade.rank} / SCORE ${grade.score}` : `RUN ${progress}%`}\n\n${stock}\n\nI programmed this cut. #ProjectToolpath`;
    try { await navigator.clipboard.writeText(payload); setMessage("RUN CARD COPIED - the stock map is ready to share."); }
    catch { setMessage("Copy unavailable. Select the stock map to share it manually."); }
  };

  return <main className={styles.shell} style={{ "--accent": contract.accent } as React.CSSProperties}>
    <header className={styles.header}>
      <Link href="#contracts" className={styles.back}><ArrowLeft/> CONTRACT SELECT</Link>
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

    <nav id="contracts" className={styles.programs} aria-label="Machining contracts">
      {CONTRACTS.map((item, index) => <button key={item.name} className={index === contractIndex ? styles.selected : ""} onClick={() => chooseContract(index)}>
        <span>{completed.includes(index) ? <CheckCircle2/> : `0${index + 1}`}</span><div><b>{item.name}</b><small>{item.subtitle}</small></div>
      </button>)}
    </nav>

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
        <dl><div><dt>GEOMETRY</dt><dd>{grade.coverage}%</dd></div><div><dt>PRECISION</dt><dd>{grade.precision}%</dd></div><div><dt>WASTE</dt><dd className={grade.waste > 12 ? styles.error : ""}>{grade.waste}%</dd></div><div><dt>CYCLE</dt><dd>{grade.cycleSeconds.toFixed(1)}s</dd></div></dl>
        {parsed.errors.length > 0 && <div className={styles.errors}>{parsed.errors.slice(0, 4).map((error) => <p key={error}>{error}</p>)}</div>}
        <button className={styles.copy} onClick={copyRun}><Copy/> COPY RUN CARD</button>
      </aside>
    </section>

    <section className={styles.transport}>
      <button onClick={reset} aria-label="Reset simulation"><RotateCcw/></button>
      <button className={styles.run} onClick={run}>{playing ? <Pause/> : <Play/>}<span>{playing ? "FEED HOLD" : "CYCLE START"}</span></button>
      <button onClick={() => { setPlaying(false); setFrame((value) => Math.min(parsed.points.length, value + 1)); setMessage("SINGLE BLOCK - one motion, one consequence."); }} aria-label="Advance one simulation frame"><StepForward/></button>
      <div className={styles.timeline}><i style={{ width: `${progress}%` }}/></div>
      <span><Zap/> 34 MS / SIM TICK</span>
    </section>

    <footer className={styles.footer}><p>CREATIVE TRAINING SIMULATION - NOT MACHINE-READY CODE OR OPERATING GUIDANCE</p><p>DETERMINISTIC KERNEL / SOURCE-LINE PROVENANCE / DEVICE-LOCAL PROGRESS</p></footer>
  </main>;
}
