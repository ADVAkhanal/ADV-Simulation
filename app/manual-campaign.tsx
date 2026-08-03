"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Award, CircleGauge, Crosshair, Factory, Gauge, Hexagon, Pause, Play, RotateCcw, ScanLine, ShieldCheck, Timer, Wrench } from "lucide-react";
import { MANUAL_CONTRACTS, MILL_COLS, MILL_ROWS, MILL_TOOLS, createManualStock, cutManualStock, gradeManualRun, isManualTarget, manualCompletion, type ManualContract } from "./manual-campaign-engine";
import styles from "./manual-campaign.module.css";

type Screen = "select" | "play" | "result";
type SaveData = { credits: number; reputation: number; cleared: string[] };
const DEFAULT_SAVE: SaveData = { credits: 250, reputation: 0, cleared: [] };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function ManualCampaign() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);
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
  const [save, setSave] = useState<SaveData>(DEFAULT_SAVE);

  const contract = MANUAL_CONTRACTS[contractIndex];
  const tool = MILL_TOOLS[toolIndex];
  const completion = useMemo(() => manualCompletion(material, contract.id), [contract.id, material]);

  useEffect(() => {
    try { setSave({ ...DEFAULT_SAVE, ...JSON.parse(localStorage.getItem("toolpath-manual-campaign-v2") ?? "{}") }); } catch { /* device progress is optional */ }
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
    const cw = canvas.width / MILL_COLS;
    const ch = canvas.height / MILL_ROWS;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    background.addColorStop(0, "#111d21"); background.addColorStop(1, "#05090b");
    context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < MILL_ROWS; row += 1) for (let col = 0; col < MILL_COLS; col += 1) {
      const index = row * MILL_COLS + col;
      const target = isManualTarget(contract.id, col, row);
      const x = col * cw; const y = row * ch;
      if (material[index]) {
        const metal = context.createLinearGradient(x, y, x + cw, y + ch);
        metal.addColorStop(0, target ? "#aebdc0" : "#7d8b8f");
        metal.addColorStop(.48, target ? "#e6edef" : "#a6b2b5");
        metal.addColorStop(1, target ? "#819094" : "#58676b");
        context.fillStyle = metal; context.fillRect(x + 1, y + 1, cw - 2, ch - 2);
      } else {
        context.fillStyle = target ? "#341321" : "#071115";
        context.fillRect(x + 1, y + 1, cw - 2, ch - 2);
      }
      if (target) { context.strokeStyle = material[index] ? `${contract.color}88` : "#ff426b"; context.lineWidth = 1.1; context.strokeRect(x + 1.5, y + 1.5, cw - 3, ch - 3); }
    }

    context.strokeStyle = `${contract.color}26`; context.lineWidth = 1;
    for (let col = 0; col <= MILL_COLS; col += 2) { context.beginPath(); context.moveTo(col * cw, 0); context.lineTo(col * cw, canvas.height); context.stroke(); }
    for (let row = 0; row <= MILL_ROWS; row += 2) { context.beginPath(); context.moveTo(0, row * ch); context.lineTo(canvas.width, row * ch); context.stroke(); }

    const radius = tool.radius * cw;
    context.beginPath(); context.arc((cursor.x + .5) * cw, (cursor.y + .5) * ch, radius, 0, Math.PI * 2);
    context.strokeStyle = spindle ? contract.color : "#e9f3f4"; context.lineWidth = 3; context.stroke();
    context.beginPath(); context.arc((cursor.x + .5) * cw, (cursor.y + .5) * ch, 4, 0, Math.PI * 2);
    context.fillStyle = spindle ? contract.color : "#e9f3f4"; context.fill();
  }, [contract, cursor, material, spindle, tool.radius]);

  useEffect(draw, [draw]);

  const resetRun = useCallback((nextContract = contractIndex) => {
    setContractIndex(nextContract); setMaterial(createManualStock()); setSpindle(false); setHeat(20); setCondition(100);
    setLoad(0); setOvercut(0); setFinishPenalty(0); setBreaks(0); setElapsed(0); setCursor({ x: 3, y: 3 }); setResult(null);
  }, [contractIndex]);

  const startContract = (index: number) => {
    resetRun(index); setScreen("play"); setMessage(`${MANUAL_CONTRACTS[index].program} loaded. Select a cutter, then start the spindle.`);
  };

  const millAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clamp((clientX - rect.left) / rect.width * MILL_COLS - .5, 0, MILL_COLS - 1);
    const y = clamp((clientY - rect.top) / rect.height * MILL_ROWS - .5, 0, MILL_ROWS - 1);
    setCursor({ x, y });
    if (!spindle || condition <= 0) return;
    const cut = cutManualStock(material, contract.id, x, y, tool.radius);
    if (!cut.engagement) { setLoad(0); return; }
    const nextLoad = clamp(Math.round(cut.engagement * 7.6 * tool.load * (feed / 55)), 0, 100);
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
    setCursor({
      x: clamp((clientX - rect.left) / rect.width * MILL_COLS - .5, 0, MILL_COLS - 1),
      y: clamp((clientY - rect.top) / rect.height * MILL_ROWS - .5, 0, MILL_ROWS - 1),
    });
  };

  const inspect = () => {
    const grade = gradeManualRun(material, contract, overcut, finishPenalty, elapsed, breaks);
    setResult(grade); setSpindle(false); setScreen("result");
    setMessage(grade.accepted ? `PART ACCEPTED — ${grade.rank} rank.` : "INSPECTION HOLD — clear more stock without touching the part.");
    if (grade.accepted) setSave((current) => {
      const firstClear = !current.cleared.includes(contract.id);
      const next = { credits: current.credits + (firstClear ? grade.payout : Math.round(grade.payout * .2)), reputation: current.reputation + (firstClear ? grade.score : 0), cleared: firstClear ? [...current.cleared, contract.id] : current.cleared };
      try { localStorage.setItem("toolpath-manual-campaign-v2", JSON.stringify(next)); } catch { /* optional */ }
      return next;
    });
  };

  const restoreTool = () => { setCondition(100); setHeat(25); setSpindle(false); setMessage("Fresh cutter loaded. Verify offset before restart."); };

  return <main className={styles.shell} style={{ "--accent": contract.color } as React.CSSProperties}>
    <header className={styles.header}>
      <div className={styles.brand}><Factory/><span>PROJECT TOOLPATH</span><strong>MANUAL MILL // CELL 01</strong></div>
      <div className={styles.shift}><i/> CREATIVE MACHINING LAB <b>SHIFT 01</b></div>
      <div className={styles.profile}><span>REP <b>{save.reputation}</b></span><span>CREDITS <b>{save.credits.toLocaleString()}</b></span></div>
    </header>

    {screen === "select" ? <ContractSelect save={save} startContract={startContract}/> : <>
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
          <button className={styles.reset} onClick={() => { resetRun(); setMessage("Stock reset. Setup retained."); }}><RotateCcw/> RESET STOCK</button>
        </aside>

        <article className={styles.machine}>
          <div className={styles.machineHead}><span><i/> VMC-01 / THREE-AXIS TRAINING CELL</span><span>PROGRAM <b>{contract.program}</b></span></div>
          <div className={styles.viewport}>
            <canvas ref={canvasRef} width={1120} height={640} aria-label="Interactive milling stock" onPointerDown={(event) => { dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); millAt(event.clientX, event.clientY); }} onPointerMove={(event) => dragging.current ? millAt(event.clientX, event.clientY) : moveCursor(event.clientX, event.clientY)} onPointerUp={() => { dragging.current = false; setLoad(0); }} onPointerCancel={() => { dragging.current = false; setLoad(0); }}/>
            <div className={styles.coordinates}><small>LIVE POSITION</small><b>X {cursor.x.toFixed(2)}</b><b>Y {cursor.y.toFixed(2)}</b><b>Z {spindle ? "-1.80" : "+4.00"}</b></div>
            <div className={styles.legend}><span><i className={styles.keep}/> PART</span><span><i className={styles.waste}/> REMOVE</span><span><i className={styles.damage}/> OVERCUT</span></div>
            {!spindle && <div className={styles.prompt}><Crosshair/><b>{completion ? "SPINDLE PAUSED" : "SET YOUR CUT"}</b><span>Drag across the stock after cycle start.</span></div>}
          </div>
          <div className={styles.controls}>
            <button className={spindle ? styles.hold : styles.start} onClick={() => { if (condition <= 0) { restoreTool(); return; } setSpindle((value) => !value); setMessage(spindle ? "FEED HOLD — spindle stopped." : "SPINDLE LIVE — trace the waste field."); }}>{spindle ? <Pause/> : <Play/>}<span>{spindle ? "FEED HOLD" : condition <= 0 ? "CHANGE TOOL" : "CYCLE START"}</span></button>
            <div className={styles.timeline}><i style={{ width: `${completion}%` }}/><span>{completion}% REMOVED</span></div>
            <button className={styles.inspect} onClick={inspect}><ScanLine/> INSPECT PART</button>
          </div>
          <div className={styles.message} role="status"><Activity/>{message}</div>
        </article>

        <aside className={styles.telemetry}>
          <div className={styles.panelTitle}><span>02</span><div><small>LIVE TELEMETRY</small><b>Process window</b></div></div>
          <div className={styles.completion}><CircleGauge/><strong>{completion}%</strong><span>PROFILE</span></div>
          <Meter icon={<Gauge/>} label="SPINDLE LOAD" value={load} suffix="%" danger={load > 84}/>
          <Meter icon={<Activity/>} label="TOOL HEAT" value={heat} suffix="°C" danger={heat > 78}/>
          <Meter icon={<Wrench/>} label="TOOL CONDITION" value={condition} suffix="%" danger={condition < 24}/>
          <dl><div><dt>ELAPSED</dt><dd>{String(Math.floor(elapsed/60)).padStart(2,"0")}:{String(elapsed%60).padStart(2,"0")}</dd></div><div><dt>OVERCUT CELLS</dt><dd className={overcut > contract.tolerance ? styles.bad : ""}>{overcut}</dd></div><div><dt>FINISH RISK</dt><dd>{finishPenalty > 7 ? "HIGH" : finishPenalty > 3 ? "MED" : "LOW"}</dd></div><div><dt>TOOL</dt><dd>T{tool.id} / {tool.diameter}</dd></div></dl>
          <div className={styles.safety}><ShieldCheck/><p><b>CREATIVE SIMULATION</b>Not machine-operating guidance. Never transfer game values to physical equipment.</p></div>
        </aside>
      </section>
    </>}

    {screen === "result" && result && <section className={styles.resultBackdrop}>
      <article className={styles.resultCard}>
        <div className={styles.rank}><Award/><span>{result.accepted ? "INSPECTION ACCEPTED" : "INSPECTION HOLD"}</span><strong>{result.rank}</strong><small>{result.score} / 100</small></div>
        <div className={styles.resultData}><div><span>GEOMETRY</span><b>{result.completion}%</b></div><div><span>PRECISION</span><b>{result.precision}/30</b></div><div><span>FINISH</span><b>{result.finish}/14</b></div><div><span>CYCLE</span><b>{result.time}/10</b></div></div>
        <p>{result.accepted ? `Released to ${contract.client}. ${result.payout.toLocaleString()} credits earned.` : `Remove at least 90% of the waste and stay within ${contract.tolerance} overcut cells.`}</p>
        <div className={styles.resultActions}><button onClick={() => { setScreen("play"); setMessage("Inspection data loaded. Revise the process."); }}>RETURN TO CELL</button><button className={styles.primary} onClick={() => result.accepted ? (contractIndex < MANUAL_CONTRACTS.length - 1 ? startContract(contractIndex + 1) : setScreen("select")) : (resetRun(), setScreen("play"))}>{result.accepted ? contractIndex < 2 ? "NEXT CONTRACT" : "CAMPAIGN INDEX" : "RETRY STOCK"}</button></div>
      </article>
    </section>}
  </main>;
}

function ContractSelect({ save, startContract }: { save: SaveData; startContract: (index: number) => void }) {
  return <section className={styles.select}>
    <div className={styles.selectIntro}><p>MANUAL CAMPAIGN / THREE MATERIAL SYSTEMS</p><h1>TURN STOCK<br/>INTO <em>FLIGHT.</em></h1><span>Read the geometry. Choose the cutter. Control engagement. Pass inspection.</span></div>
    <div className={styles.contractGrid}>{MANUAL_CONTRACTS.map((contract, index) => <button key={contract.id} style={{ "--card-accent": contract.color } as React.CSSProperties} onClick={() => startContract(index)}>
      <header><span>0{index + 1}</span><b>{save.cleared.includes(contract.id) ? "CLEARED" : index === 0 || save.cleared.length >= index ? "AVAILABLE" : "CHALLENGE"}</b></header>
      <div className={styles.geometry}><GeometryPreview contract={contract}/></div>
      <small>{contract.client}</small><h2>{contract.title}</h2><p>{contract.brief}</p>
      <footer><span>{contract.material}</span><span>{contract.reward.toLocaleString()} CR</span><strong>ENTER CELL &rarr;</strong></footer>
    </button>)}</div>
    <div className={styles.principles}><span><b>01</b> GEOMETRY IS THE BRIEF</span><span><b>02</b> ENGAGEMENT IS THE RISK</span><span><b>03</b> INSPECTION IS THE TRUTH</span></div>
  </section>;
}

function GeometryPreview({ contract }: { contract: ManualContract }) {
  return <svg viewBox={`0 0 ${MILL_COLS} ${MILL_ROWS}`} aria-hidden="true">{Array.from({length:MILL_COLS*MILL_ROWS},(_,index)=>{const col=index%MILL_COLS; const row=Math.floor(index/MILL_COLS); return isManualTarget(contract.id,col,row)?<rect key={index} x={col+.08} y={row+.08} width=".84" height=".84"/>:null;})}</svg>;
}

function Meter({ icon, label, value, suffix, danger }: { icon: React.ReactNode; label: string; value: number; suffix: string; danger: boolean }) {
  return <div className={`${styles.meter} ${danger ? styles.danger : ""}`}><span>{icon}{label}</span><b>{Math.round(value)}{suffix}</b><i><em style={{ width: `${clamp(value,0,100)}%` }}/></i></div>;
}
