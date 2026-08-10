"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Award, CircleGauge, Crosshair, Factory, Gauge, Hexagon, LockKeyhole, Pause, Play, RotateCcw, ScanLine, ShieldCheck, Wrench } from "lucide-react";
import {
  DEFAULT_MANUAL_SAVE,
  MANUAL_CONTRACTS,
  MILL_COLS,
  MILL_ROWS,
  MILL_TOOLS,
  allManualOperationsComplete,
  buildManualMeasurements,
  createManualFinishMap,
  createManualStock,
  evaluateManualDisposition,
  gradeManualRun,
  isManualBoundary,
  isManualTarget,
  machineManualStock,
  manualCellOperation,
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
} from "./manual-campaign-engine";
import baseStyles from "./manual-campaign.module.css";
import retentionStyles from "./manual-campaign-retention.module.css";

const styles = { ...baseStyles, ...retentionStyles };

type Screen = "select" | "play" | "inspection" | "result";
type RunResult = ManualGrade & { disposition: InspectionDisposition };
const SAVE_KEY = "toolpath-manual-campaign-v3";
const LEGACY_SAVE_KEY = "toolpath-manual-campaign-v2";
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function ManualCampaign() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);
  const [screen, setScreen] = useState<Screen>("select");
  const [contractIndex, setContractIndex] = useState(0);
  const [operationIndex, setOperationIndex] = useState(0);
  const [toolIndex, setToolIndex] = useState(1);
  const [material, setMaterial] = useState(createManualStock);
  const [finished, setFinished] = useState(createManualFinishMap);
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
  const [message, setMessage] = useState("Choose a contract. Geometry changes the process plan.");
  const [result, setResult] = useState<RunResult | null>(null);
  const [save, setSave] = useState<ManualSaveData>(DEFAULT_MANUAL_SAVE);
  const [selectedCharacteristic, setSelectedCharacteristic] = useState("");
  const [instrument, setInstrument] = useState<InspectionInstrumentId>("touch-probe");
  const [measured, setMeasured] = useState<Record<string, ManualMeasurement>>({});
  const [inspectionMistakes, setInspectionMistakes] = useState(0);

  const contract = MANUAL_CONTRACTS[contractIndex];
  const operation = contract.operations[Math.min(operationIndex, contract.operations.length - 1)];
  const tool = MILL_TOOLS[toolIndex];
  const completion = useMemo(() => manualCompletion(material, contract.id), [contract.id, material]);
  const operationProgress = useMemo(() => manualOperationProgress(material, finished, contract.id, operation.id), [contract.id, finished, material, operation.id]);
  const operationsComplete = useMemo(() => allManualOperationsComplete(material, finished, contract), [contract, finished, material]);
  const readings = useMemo(() => buildManualMeasurements(material, finished, contract, overcut, finishPenalty, breaks), [breaks, contract, finishPenalty, finished, material, overcut]);

  useEffect(() => {
    let migrated = DEFAULT_MANUAL_SAVE;
    try {
      const current = localStorage.getItem(SAVE_KEY);
      const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
      migrated = migrateManualSave(JSON.parse(current ?? legacy ?? "{}"));
      localStorage.setItem(SAVE_KEY, JSON.stringify(migrated));
    } catch { /* device progress is optional */ }
    const hydration = window.setTimeout(() => setSave(migrated), 0);
    return () => window.clearTimeout(hydration);
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
      const cellOperation = manualCellOperation(contract.id, col, row);
      const x = col * cw; const y = row * ch;
      if (material[index]) {
        const metal = context.createLinearGradient(x, y, x + cw, y + ch);
        const activeWaste = !target && cellOperation === operation.id;
        metal.addColorStop(0, target ? "#aebdc0" : activeWaste ? "#90aeb4" : "#627176");
        metal.addColorStop(.48, target ? "#e6edef" : activeWaste ? "#c4d5d8" : "#89969a");
        metal.addColorStop(1, target ? "#819094" : activeWaste ? "#617d83" : "#465459");
        context.fillStyle = metal; context.fillRect(x + 1, y + 1, cw - 2, ch - 2);
      } else {
        context.fillStyle = target ? "#341321" : "#071115";
        context.fillRect(x + 1, y + 1, cw - 2, ch - 2);
      }
      if (target) {
        context.strokeStyle = material[index] ? `${contract.color}88` : "#ff426b";
        context.lineWidth = 1.1; context.strokeRect(x + 1.5, y + 1.5, cw - 3, ch - 3);
      } else if (material[index] && cellOperation === operation.id) {
        context.strokeStyle = `${contract.color}58`; context.lineWidth = 1; context.strokeRect(x + 2, y + 2, cw - 4, ch - 4);
      }
      if (finished[index] && isManualBoundary(contract.id, col, row)) {
        context.strokeStyle = contract.color; context.lineWidth = 3; context.strokeRect(x + 3, y + 3, cw - 6, ch - 6);
      }
    }

    context.strokeStyle = `${contract.color}26`; context.lineWidth = 1;
    for (let col = 0; col <= MILL_COLS; col += 2) { context.beginPath(); context.moveTo(col * cw, 0); context.lineTo(col * cw, canvas.height); context.stroke(); }
    for (let row = 0; row <= MILL_ROWS; row += 2) { context.beginPath(); context.moveTo(0, row * ch); context.lineTo(canvas.width, row * ch); context.stroke(); }

    const radius = tool.radius * cw;
    context.beginPath(); context.arc((cursor.x + .5) * cw, (cursor.y + .5) * ch, radius, 0, Math.PI * 2);
    context.strokeStyle = spindle ? contract.color : "#e9f3f4"; context.lineWidth = 3; context.stroke();
    context.beginPath(); context.arc((cursor.x + .5) * cw, (cursor.y + .5) * ch, 4, 0, Math.PI * 2);
    context.fillStyle = spindle ? contract.color : "#e9f3f4"; context.fill();
  }, [contract, cursor, finished, material, operation.id, spindle, tool.radius]);

  useEffect(draw, [draw]);

  const persistSave = (next: ManualSaveData) => {
    setSave(next);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(next)); } catch { /* optional */ }
  };

  const toolForOperation = (operationId: ManualOperationId) => Math.max(0, MILL_TOOLS.findIndex((item) => item.operations.includes(operationId)));

  const resetRun = useCallback((nextContract = contractIndex) => {
    const next = MANUAL_CONTRACTS[nextContract];
    setContractIndex(nextContract); setOperationIndex(0); setToolIndex(toolForOperation(next.operations[0].id));
    setMaterial(createManualStock()); setFinished(createManualFinishMap()); setSpindle(false); setHeat(20); setCondition(100);
    setLoad(0); setOvercut(0); setFinishPenalty(0); setBreaks(0); setElapsed(0); setCursor({ x: 3, y: 3 }); setResult(null);
    setMeasured({}); setInspectionMistakes(0); setSelectedCharacteristic(next.inspection[0].id); setInstrument(next.inspection[0].instrument);
  }, [contractIndex]);

  const startContract = (index: number) => {
    resetRun(index); setScreen("play");
    setMessage(`${MANUAL_CONTRACTS[index].program} loaded. Complete ${MANUAL_CONTRACTS[index].operations[0].label.toLowerCase()} first.`);
  };

  const cutAt = (x: number, y: number) => {
    setCursor({ x, y });
    if (!spindle || condition <= 0) return;
    const cut = machineManualStock(material, finished, contract.id, operation.id, tool, x, y);
    if (!cut.compatible) {
      setLoad(0); setMessage(`T${tool.id} LOCKOUT — ${tool.name.toLowerCase()} cannot perform ${operation.label.toLowerCase()}.`); return;
    }
    if (!cut.engagement) {
      setLoad(0);
      if (cut.mismatch) setMessage(`${operation.label.toUpperCase()} ACTIVE — that stock belongs to another operation.`);
      return;
    }
    const nextLoad = clamp(Math.round(cut.engagement * 7.6 * tool.load * (feed / 55)), 0, 100);
    const heatGain = cut.engagement * .45 * tool.load * (feed / 50);
    const wear = cut.engagement * .055 * tool.wear * (1 + Math.max(0, feed - 70) / 35);
    setMaterial(cut.material); setFinished(cut.finished); setOvercut((value) => value + cut.overcut); setLoad(nextLoad);
    setHeat((value) => clamp(value + heatGain, 18, 100));
    setCondition((value) => {
      const next = clamp(value - wear, 0, 100);
      if (next <= 0 && value > 0) { setBreaks((count) => count + 1); setSpindle(false); setMessage("TOOL FAILURE — reset the cutter and reduce engagement."); }
      return next;
    });
    setFinishPenalty((value) => operation.id === "finish"
      ? Math.max(0, value - cut.correct * .075)
      : value + Math.max(0, nextLoad - 82) * .018 * tool.finish + cut.overcut * .25);
  };

  const millAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    cutAt(clamp((clientX - rect.left) / rect.width * MILL_COLS - .5, 0, MILL_COLS - 1), clamp((clientY - rect.top) / rect.height * MILL_ROWS - .5, 0, MILL_ROWS - 1));
  };

  const moveCursor = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setCursor({ x: clamp((clientX - rect.left) / rect.width * MILL_COLS - .5, 0, MILL_COLS - 1), y: clamp((clientY - rect.top) / rect.height * MILL_ROWS - .5, 0, MILL_ROWS - 1) });
  };

  const jog = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const step = event.shiftKey ? .25 : 1;
    const moves: Record<string, [number, number]> = { arrowleft: [-step, 0], a: [-step, 0], arrowright: [step, 0], d: [step, 0], arrowup: [0, -step], w: [0, -step], arrowdown: [0, step], s: [0, step] };
    const key = event.key.toLowerCase();
    if (moves[key]) { event.preventDefault(); const [dx, dy] = moves[key]; cutAt(clamp(cursor.x + dx, 0, MILL_COLS - 1), clamp(cursor.y + dy, 0, MILL_ROWS - 1)); return; }
    if (key === " " || key === "enter") { event.preventDefault(); cutAt(cursor.x, cursor.y); }
  };

  const toggleSpindle = () => {
    if (condition <= 0) { restoreTool(); return; }
    if (!tool.operations.includes(operation.id)) { setMessage(`SETUP HOLD — choose a tool rated for ${operation.label.toLowerCase()}.`); return; }
    setSpindle((value) => !value); setMessage(spindle ? "FEED HOLD — spindle stopped." : `${operation.label.toUpperCase()} LIVE — ${operation.instruction}`);
  };

  const advanceOperation = () => {
    if (operationProgress < operation.requiredProgress) { setMessage(`${operation.label.toUpperCase()} HOLD — reach ${operation.requiredProgress}% before signoff.`); return; }
    setSpindle(false); setLoad(0);
    if (operationIndex < contract.operations.length - 1) {
      const nextIndex = operationIndex + 1; const nextOperation = contract.operations[nextIndex];
      setOperationIndex(nextIndex); setToolIndex(toolForOperation(nextOperation.id)); setMessage(`${operation.label.toUpperCase()} SIGNED OFF — ${nextOperation.label.toLowerCase()} is now active.`);
    } else {
      setMeasured({}); setInspectionMistakes(0); setSelectedCharacteristic(contract.inspection[0].id); setInstrument(contract.inspection[0].instrument);
      setScreen("inspection"); setMessage("INSPECTION BAY — measure every characteristic, then disposition the part.");
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
      setMessage(`REWORK ROUTED — return to ${contract.operations[nextIndex].label.toLowerCase()} and correct the failed characteristic.`); return;
    }
    const grade = gradeManualRun(material, contract, overcut, finishPenalty, elapsed, breaks, inspectionScore, operationsComplete);
    const finalResult: RunResult = { ...grade, disposition: chosen };
    const nextSave = recordManualAttempt(save, contract, finalResult);
    persistSave(nextSave); setResult(finalResult); setScreen("result"); setSpindle(false);
    setMessage(chosen === "accept" ? `PART ACCEPTED — ${grade.rank} mastery.` : "PART SCRAPPED — correct disposition protected the customer.");
  };

  const restoreTool = () => { setCondition(100); setHeat(25); setSpindle(false); setMessage("Fresh cutter loaded. Verify the active operation before restart."); };

  return <main className={styles.shell} style={{ "--accent": contract.color } as React.CSSProperties}>
    <header className={styles.header}>
      <div className={styles.brand}><Factory/><span>PROJECT TOOLPATH</span><strong>MANUAL MILL // CELL 01</strong></div>
      <div className={styles.shift}><i/> CREATIVE MACHINING LAB <b>SHIFT 01</b></div>
      <div className={styles.profile}><span>ATTEMPTS <b>{save.totalAttempts}</b></span><span>REP <b>{save.reputation}</b></span><span>CREDITS <b>{save.credits.toLocaleString()}</b></span></div>
    </header>

    {screen === "select" ? <ContractSelect save={save} startContract={startContract}/> : <>
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
            return <button key={item.id} disabled={spindle} data-compatible={compatible} className={index === toolIndex ? styles.activeTool : ""} onClick={() => { setToolIndex(index); setMessage(`${item.name} selected — ${compatible ? item.role : item.limitation}`); }}>
              <span>T{item.id}</span><div><b>{item.name}</b><small>{item.diameter} / {item.role}</small></div><em>{compatible ? "READY" : "LOCK"}</em>
            </button>;
          })}</div>
          <label className={styles.feed}><span>FEED OVERRIDE <b>{feed}%</b></span><input type="range" min="25" max="115" value={feed} onChange={(event) => setFeed(Number(event.target.value))}/></label>
          <div className={styles.strategy}><Hexagon/><p><b>{operation.label.toUpperCase()} NOTE</b>{operation.instruction} {tool.limitation}</p></div>
          <button className={styles.reset} onClick={() => { resetRun(); setMessage("Stock and process plan reset."); }}><RotateCcw/> RESET CONTRACT</button>
        </aside>

        <article className={styles.machine}>
          <div className={styles.machineHead}><span><i/> VMC-01 / MULTI-OP TRAINING CELL</span><span>PROGRAM <b>{contract.program}</b></span></div>
          <div className={styles.viewport}>
            <canvas ref={canvasRef} width={1120} height={640} tabIndex={0} aria-label={`Interactive ${operation.label.toLowerCase()} operation. Drag to machine, or use arrow keys or WASD to jog and Space or Enter to cut.`} onPointerDown={(event) => { dragging.current = true; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); millAt(event.clientX, event.clientY); }} onPointerMove={(event) => dragging.current ? millAt(event.clientX, event.clientY) : moveCursor(event.clientX, event.clientY)} onPointerUp={() => { dragging.current = false; setLoad(0); }} onPointerCancel={() => { dragging.current = false; setLoad(0); }} onKeyDown={jog}/>
            <div className={styles.coordinates}><small>LIVE POSITION / {operation.label.toUpperCase()}</small><b>X {cursor.x.toFixed(2)}</b><b>Y {cursor.y.toFixed(2)}</b><b>Z {spindle ? "-1.80" : "+4.00"}</b></div>
            <div className={styles.legend}><span><i className={styles.keep}/> PART</span><span><i className={styles.waste}/> ACTIVE OP</span><span><i className={styles.damage}/> OVERCUT</span></div>
            {!spindle && <div className={styles.prompt}><Crosshair/><b>{operationProgress ? "OPERATION PAUSED" : `${operation.label.toUpperCase()} SETUP`}</b><span>{operation.instruction}</span></div>}
          </div>
          <div className={styles.controls}>
            <button className={spindle ? styles.hold : styles.start} onClick={toggleSpindle}>{spindle ? <Pause/> : <Play/>}<span>{spindle ? "FEED HOLD" : condition <= 0 ? "CHANGE TOOL" : "CYCLE START"}</span></button>
            <div className={styles.timeline}><i style={{ width: `${operationProgress}%` }}/><span>{operation.label.toUpperCase()} {operationProgress}% / OVERALL {completion}%</span></div>
            <button className={styles.inspect} disabled={operationProgress < operation.requiredProgress} onClick={advanceOperation}><ScanLine/> {operationIndex < contract.operations.length - 1 ? "SIGN OFF OP" : "OPEN INSPECTION"}</button>
          </div>
          <div className={styles.message} role="status"><Activity/>{message}</div>
        </article>

        <aside className={styles.telemetry}>
          <div className={styles.panelTitle}><span>02</span><div><small>LIVE TELEMETRY</small><b>Process window</b></div></div>
          <div className={styles.completion}><CircleGauge/><strong>{operationProgress}%</strong><span>{operation.label.toUpperCase()}</span></div>
          <Meter icon={<Gauge/>} label="SPINDLE LOAD" value={load} suffix="%" danger={load > 84}/>
          <Meter icon={<Activity/>} label="TOOL HEAT" value={heat} suffix="°C" danger={heat > 78}/>
          <Meter icon={<Wrench/>} label="TOOL CONDITION" value={condition} suffix="%" danger={condition < 24}/>
          <dl><div><dt>ELAPSED</dt><dd>{String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}</dd></div><div><dt>OVERCUT CELLS</dt><dd className={overcut > contract.tolerance ? styles.bad : ""}>{overcut}</dd></div><div><dt>FINISH RISK</dt><dd>{finishPenalty > 7 ? "HIGH" : finishPenalty > 3 ? "MED" : "LOW"}</dd></div><div><dt>TOOL FIT</dt><dd className={!tool.operations.includes(operation.id) ? styles.bad : ""}>{tool.operations.includes(operation.id) ? "VALID" : "LOCKED"}</dd></div></dl>
          <div className={styles.safety}><ShieldCheck/><p><b>FICTIONALIZED SIMULATION</b>Dimensions and readings are invented gameplay values, not machine-operating or inspection guidance.</p></div>
        </aside>
      </section>}
    </>}

    {screen === "result" && result && <section className={styles.resultBackdrop}>
      <article className={styles.resultCard}>
        <div className={styles.rank}><Award/><span>{result.disposition === "scrap" ? "SCRAP DECISION CONFIRMED" : result.accepted ? "INSPECTION ACCEPTED" : "INSPECTION HOLD"}</span><strong>{result.disposition === "scrap" ? "X" : result.rank}</strong><small>{result.score} / 100</small></div>
        <div className={styles.resultData}><div><span>GEOMETRY</span><b>{result.geometry}/40</b></div><div><span>PRECISION</span><b>{result.precision}/25</b></div><div><span>FINISH</span><b>{result.finish}/15</b></div><div><span>INSPECTION</span><b>{result.inspection}/10</b></div></div>
        <p>{result.disposition === "scrap" ? "The failed tolerance was correctly contained. Reset the stock and revise the process." : `Released to ${contract.client}. ${result.payout.toLocaleString()} credits earned.`}</p>
        <div className={styles.resultActions}><button onClick={() => { setScreen("inspection"); setMessage("Inspection record reopened for review."); }}>REVIEW FINDINGS</button><button className={styles.primary} onClick={() => result.accepted && contractIndex < MANUAL_CONTRACTS.length - 1 ? startContract(contractIndex + 1) : result.accepted ? setScreen("select") : (resetRun(), setScreen("play"))}>{result.accepted ? contractIndex < MANUAL_CONTRACTS.length - 1 ? "NEXT CONTRACT" : "CAMPAIGN INDEX" : "RETRY STOCK"}</button></div>
      </article>
    </section>}
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
      <aside className={styles.findings}><h2>03 / FINDINGS</h2><div className={styles.findingList}>{readings.map((reading) => <div key={reading.id}><span>{reading.label}</span><b>{measured[reading.id] ? `${measured[reading.id].actual.toFixed(3)} / ±${reading.tolerance.toFixed(2)}` : "PENDING"}</b><em className={measured[reading.id] ? measured[reading.id].pass ? styles.pass : styles.fail : ""}>{measured[reading.id] ? measured[reading.id].pass ? "PASS" : "FAIL" : "—"}</em></div>)}</div><div className={styles.disposition}><small>FINAL DISPOSITION</small><p>{allMeasured ? "Use the evidence. An incorrect disposition is blocked and costs inspection mastery." : "All characteristics must be measured."}</p><button disabled={!allMeasured} onClick={() => dispositionPart("accept")}>ACCEPT</button><button disabled={!allMeasured} onClick={() => dispositionPart("rework")}>REWORK</button><button disabled={!allMeasured} onClick={() => dispositionPart("scrap")}>SCRAP</button></div><div className={styles.safety}><ShieldCheck/><p><b>SIMULATION BOUNDARY</b>Readings use fictional SIM units and do not define a real inspection plan.</p></div></aside>
    </div>
  </section>;
}

function ContractSelect({ save, startContract }: { save: ManualSaveData; startContract: (index: number) => void }) {
  return <section className={styles.select}>
    <div className={styles.selectIntro}><p>MANUAL CAMPAIGN / RETENTION GATE</p><h1>PLAN. CUT.<br/>PROVE <em>QUALITY.</em></h1><span>Four operations. Three tool identities. Active inspection. Mastery persists on this device.</span></div>
    <div className={styles.contractGrid}>{MANUAL_CONTRACTS.map((contract, index) => {
      const unlocked = index === 0 || MANUAL_CONTRACTS.slice(0, index).every((item) => save.cleared.includes(item.id));
      const mastery = save.mastery[contract.id];
      return <button key={contract.id} disabled={!unlocked} style={{ "--card-accent": contract.color } as React.CSSProperties} onClick={() => startContract(index)}>
        <header><span>0{index + 1}</span><b>{!unlocked ? <><LockKeyhole/> LOCKED</> : mastery?.accepted ? `${mastery.bestRank} / ${mastery.bestScore}` : "AVAILABLE"}</b></header>
        <div className={styles.geometry}><GeometryPreview contract={contract}/></div>
        <small>{contract.client}</small><h2>{contract.title}</h2><p>{contract.brief}</p>
        <div className={styles.contractOps}>{contract.operations.map((operation) => <span key={operation.id}>{operation.label}</span>)}</div>
        <footer><span>{contract.material}</span><span>{mastery?.attempts ?? 0} ATTEMPTS</span><strong>{unlocked ? "ENTER CELL →" : "CLEAR PRIOR CONTRACT"}</strong></footer>
      </button>;
    })}</div>
    <div className={styles.principles}><span><b>01</b> PLAN THE OPERATIONS</span><span><b>02</b> MATCH TOOL TO CUT</span><span><b>03</b> MEASURE BEFORE RELEASE</span></div>
  </section>;
}

function GeometryPreview({ contract }: { contract: ManualContract }) {
  return <svg viewBox={`0 0 ${MILL_COLS} ${MILL_ROWS}`} aria-hidden="true">{Array.from({ length: MILL_COLS * MILL_ROWS }, (_, index) => { const col = index % MILL_COLS; const row = Math.floor(index / MILL_COLS); return isManualTarget(contract.id, col, row) ? <rect key={index} x={col + .08} y={row + .08} width=".84" height=".84"/> : null; })}</svg>;
}

function Meter({ icon, label, value, suffix, danger }: { icon: React.ReactNode; label: string; value: number; suffix: string; danger: boolean }) {
  return <div className={`${styles.meter} ${danger ? styles.danger : ""}`}><span>{icon}{label}</span><b>{Math.round(value)}{suffix}</b><i><em style={{ width: `${clamp(value, 0, 100)}%` }}/></i></div>;
}
