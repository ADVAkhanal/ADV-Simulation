"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleDollarSign, Gauge, Keyboard, MousePointer2, Power, RotateCcw, Ruler, ShieldAlert, Thermometer, Trophy, Volume2, VolumeX, Wrench, Zap } from "lucide-react";
import { GRID_COLS, GRID_ROWS, completionFor, createStock, cutStock, inspectPart, isTargetCell, type InspectionResult } from "./game-engine";

type Screen = "brief" | "play" | "result";
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };
const CONTRACT_REWARD = 1700;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerDown = useRef(false);
  const brokenRef = useRef(false);
  const particles = useRef<Particle[]>([]);
  const audioRef = useRef<{ context: AudioContext; oscillator: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null>(null);
  const [screen, setScreen] = useState<Screen>("brief");
  const [material, setMaterial] = useState<Uint8Array>(() => createStock());
  const [cutter, setCutter] = useState({ x: 2, y: 2 });
  const [spindleOn, setSpindleOn] = useState(false);
  const [feed, setFeed] = useState(58);
  const [heat, setHeat] = useState(18);
  const [tool, setTool] = useState(100);
  const [load, setLoad] = useState(0);
  const [overcut, setOvercut] = useState(0);
  const [finishPenalty, setFinishPenalty] = useState(0);
  const [toolBreaks, setToolBreaks] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState("Accept the contract to enter the shop.");
  const [muted, setMuted] = useState(false);
  const [credits, setCredits] = useState(250);
  const [bestScore, setBestScore] = useState(0);
  const [contracts, setContracts] = useState(0);
  const [result, setResult] = useState<InspectionResult | null>(null);
  const completion = useMemo(() => completionFor(material), [material]);
  const shopLevel = 1 + Math.floor(contracts / 3);
  const objectiveState = completion < 20 ? 0 : completion < 88 ? 1 : 2;
  const warning = heat >= 82 || load >= 92 || tool <= 25;

  useEffect(() => {
    try {
      const save = JSON.parse(localStorage.getItem("toolpath-save-v1") ?? "{}");
      if (typeof save.credits === "number") setCredits(save.credits);
      if (typeof save.bestScore === "number") setBestScore(save.bestScore);
      if (typeof save.contracts === "number") setContracts(save.contracts);
    } catch { /* corrupt local saves never block play */ }
  }, []);

  const persist = useCallback((nextCredits: number, nextBest: number, nextContracts: number) => {
    try { localStorage.setItem("toolpath-save-v1", JSON.stringify({ credits: nextCredits, bestScore: nextBest, contracts: nextContracts })); } catch { /* optional */ }
  }, []);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.gain.gain.setTargetAtTime(0, audio.context.currentTime, 0.03);
    window.setTimeout(() => { try { audio.oscillator.stop(); } catch { /* stopped */ } void audio.context.close(); }, 100);
    audioRef.current = null;
  }, []);

  const startAudio = useCallback(() => {
    if (muted || audioRef.current) return;
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const context = new AudioCtor();
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = "sawtooth"; oscillator.frequency.value = 74;
    filter.type = "lowpass"; filter.frequency.value = 320; gain.gain.value = 0.025;
    oscillator.connect(filter).connect(gain).connect(context.destination); oscillator.start();
    audioRef.current = { context, oscillator, gain, filter };
  }, [muted]);

  const updateAudio = useCallback((nextLoad: number) => {
    const audio = audioRef.current;
    if (!audio || muted) return;
    const now = audio.context.currentTime;
    audio.oscillator.frequency.setTargetAtTime(72 + nextLoad * 0.42 + feed * 0.08, now, 0.025);
    audio.filter.frequency.setTargetAtTime(260 + nextLoad * 8, now, 0.03);
    audio.gain.gain.setTargetAtTime(0.02 + nextLoad * 0.00045, now, 0.025);
  }, [feed, muted]);

  useEffect(() => { if (muted) stopAudio(); else if (spindleOn) startAudio(); }, [muted, spindleOn, startAudio, stopAudio]);
  useEffect(() => () => stopAudio(), [stopAudio]);

  const resetRun = useCallback((nextScreen: Screen = "play") => {
    stopAudio(); brokenRef.current = false; particles.current = [];
    setMaterial(createStock()); setCutter({ x: 2, y: 2 }); setSpindleOn(false); setFeed(58); setHeat(18); setTool(100); setLoad(0);
    setOvercut(0); setFinishPenalty(0); setToolBreaks(0); setElapsed(0); setResult(null);
    setMessage("Stock loaded. Start the spindle, then clear everything outside the cyan blueprint."); setScreen(nextScreen);
  }, [stopAudio]);

  const triggerToolBreak = useCallback(() => {
    if (!brokenRef.current) return;
    setSpindleOn(false); stopAudio(); setToolBreaks((value) => value + 1); setCredits((value) => Math.max(0, value - 60));
    setMessage("TOOL BREAK — overload snapped the end mill. Replacement cost: 60 cr.");
    window.setTimeout(() => { setTool(100); setHeat((value) => Math.min(value, 55)); brokenRef.current = false; setMessage("Replacement installed. Reduce feed or take lighter engagement before restarting."); }, 1400);
  }, [stopAudio]);

  const performCut = useCallback((x: number, y: number) => {
    setCutter({ x, y });
    if (screen !== "play" || !spindleOn || brokenRef.current) {
      if (screen === "play" && !spindleOn && !brokenRef.current) setMessage("Spindle is stopped. Start it before entering the stock.");
      return;
    }
    setMaterial((current) => {
      const cut = cutStock(current, x, y);
      if (cut.engagement === 0) { setLoad((value) => Math.max(0, value - 7)); return current; }
      const nextLoad = clamp((cut.engagement / 5.5) * feed * 1.25, 8, 125);
      const overloaded = nextLoad > 88 || (feed > 82 && cut.engagement >= 4);
      const heatGain = cut.engagement * (0.55 + feed / 115) + (overloaded ? 3.2 : 0);
      const wear = 0.45 + cut.engagement * feed * 0.008 + (overloaded ? 4.8 : 0);
      setLoad(nextLoad); setHeat((value) => clamp(value + heatGain, 0, 100)); setOvercut((value) => value + cut.overcut);
      setFinishPenalty((value) => value + (overloaded ? 0.7 : feed > 75 ? 0.18 : 0.04));
      setTool((value) => {
        const next = clamp(value - wear - (heat > 88 ? 3 : 0), 0, 100);
        if (next <= 0 && !brokenRef.current) { brokenRef.current = true; window.setTimeout(triggerToolBreak, 0); }
        return next;
      });
      if (cut.overcut > 0) setMessage(`DIMENSIONAL ERROR — ${cut.overcut} keep-zone cell${cut.overcut > 1 ? "s" : ""} removed.`);
      else if (overloaded) setMessage("CHATTER — unstable cut. Back off the feed or leave the stock.");
      else setMessage(`Clean engagement. ${cut.correct} stock cell${cut.correct !== 1 ? "s" : ""} removed.`);
      const cw = 960 / GRID_COLS; const ch = 560 / GRID_ROWS;
      for (let i = 0; i < Math.min(14, cut.engagement * 3); i += 1) particles.current.push({ x: (x + .5) * cw, y: (y + .5) * ch, vx: (Math.random() - .35) * 5.5, vy: -2 - Math.random() * 4, life: 22 + Math.random() * 18, color: overloaded ? "#ff6b2c" : "#ffd36b" });
      updateAudio(nextLoad); return cut.material;
    });
  }, [feed, heat, screen, spindleOn, triggerToolBreak, updateAudio]);

  const toggleSpindle = useCallback(() => {
    if (screen !== "play" || brokenRef.current) return;
    setSpindleOn((current) => { const next = !current; setMessage(next ? "Spindle at speed. Enter from the outside edge." : "Spindle stopped. Heat is bleeding off."); if (next) startAudio(); else stopAudio(); return next; });
  }, [screen, startAudio, stopAudio]);

  const inspect = useCallback(() => {
    if (screen !== "play") return;
    setSpindleOn(false); stopAudio();
    const nextResult = inspectPart({ material, overcut, finishPenalty, elapsedSeconds: elapsed, toolBreaks });
    setResult(nextResult); setScreen("result");
    const nextCredits = credits + nextResult.payout; const nextBest = Math.max(bestScore, nextResult.score); const nextContracts = contracts + (nextResult.accepted ? 1 : 0);
    setCredits(nextCredits); setBestScore(nextBest); setContracts(nextContracts); persist(nextCredits, nextBest, nextContracts);
  }, [bestScore, contracts, credits, elapsed, finishPenalty, material, overcut, persist, screen, stopAudio, toolBreaks]);

  useEffect(() => {
    if (screen !== "play") return;
    const timer = window.setInterval(() => { setElapsed((value) => value + .1); setLoad((value) => Math.max(0, value - 5)); setHeat((value) => Math.max(16, value - (spindleOn ? .38 : 1.05))); }, 100);
    return () => window.clearInterval(timer);
  }, [screen, spindleOn]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (screen !== "play") return;
      if (event.key === " ") { event.preventDefault(); toggleSpindle(); return; }
      if (event.key.toLowerCase() === "i") { inspect(); return; }
      if (event.key.toLowerCase() === "r") { resetRun(); return; }
      const delta = event.shiftKey ? .35 : .72; let x = cutter.x; let y = cutter.y;
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") x -= delta;
      else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") x += delta;
      else if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") y -= delta;
      else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") y += delta;
      else return;
      event.preventDefault(); performCut(clamp(x, 0, GRID_COLS - 1), clamp(y, 0, GRID_ROWS - 1));
    };
    window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey);
  }, [cutter, inspect, performCut, resetRun, screen, toggleSpindle]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const context = canvas.getContext("2d"); if (!context) return;
    let frame = 0;
    const draw = () => {
      const width = canvas.width; const height = canvas.height; const cw = width / GRID_COLS; const ch = height / GRID_ROWS;
      const background = context.createLinearGradient(0, 0, 0, height); background.addColorStop(0, "#101820"); background.addColorStop(1, "#05080b"); context.fillStyle = background; context.fillRect(0, 0, width, height);
      context.strokeStyle = "rgba(111,170,195,.09)"; context.lineWidth = 1;
      for (let col = 0; col <= GRID_COLS; col += 1) { context.beginPath(); context.moveTo(col * cw, 0); context.lineTo(col * cw, height); context.stroke(); }
      for (let row = 0; row <= GRID_ROWS; row += 1) { context.beginPath(); context.moveTo(0, row * ch); context.lineTo(width, row * ch); context.stroke(); }
      for (let row = 0; row < GRID_ROWS; row += 1) for (let col = 0; col < GRID_COLS; col += 1) {
        const index = row * GRID_COLS + col; const x = col * cw; const y = row * ch;
        if (material[index]) { const metal = context.createLinearGradient(x, y, x + cw, y + ch); metal.addColorStop(0, isTargetCell(col, row) ? "#aebbc1" : "#8e9ba1"); metal.addColorStop(.46, "#d8e0e2"); metal.addColorStop(1, "#65747b"); context.fillStyle = metal; context.fillRect(x + .7, y + .7, cw - 1.4, ch - 1.4); context.fillStyle = "rgba(255,255,255,.08)"; context.fillRect(x + 2, y + 2, cw - 4, 2); }
        else { context.fillStyle = "rgba(0,0,0,.22)"; context.fillRect(x + 1, y + 1, cw - 2, ch - 2); }
        if (isTargetCell(col, row)) {
          context.strokeStyle = material[index] ? "rgba(73,224,255,.42)" : "rgba(255,76,72,.65)"; context.lineWidth = material[index] ? 1.1 : 1.8;
          [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dx,dy], side) => { if (isTargetCell(col + dx, row + dy)) return; context.beginPath(); if (side === 0) { context.moveTo(x,y); context.lineTo(x,y+ch); } if (side === 1) { context.moveTo(x+cw,y); context.lineTo(x+cw,y+ch); } if (side === 2) { context.moveTo(x,y); context.lineTo(x+cw,y); } if (side === 3) { context.moveTo(x,y+ch); context.lineTo(x+cw,y+ch); } context.stroke(); });
        }
      }
      particles.current = particles.current.filter((particle) => { particle.x += particle.vx; particle.y += particle.vy; particle.vy += .16; particle.life -= 1; if (particle.life <= 0) return false; context.fillStyle = particle.color; context.globalAlpha = Math.min(1, particle.life / 12); context.fillRect(particle.x, particle.y, 2.4, 2.4); context.globalAlpha = 1; return true; });
      const toolX = (cutter.x + .5) * cw; const toolY = (cutter.y + .5) * ch;
      context.save(); context.translate(toolX, toolY); context.rotate(performance.now() * (spindleOn ? .012 : .001)); context.shadowColor = spindleOn ? "#50e6ff" : "transparent"; context.shadowBlur = spindleOn ? 18 : 0;
      context.fillStyle = brokenRef.current ? "#ff3d3d" : "#d7e1e4"; context.beginPath(); context.arc(0, 0, cw * .62, 0, Math.PI * 2); context.fill(); context.fillStyle = "#233038"; context.beginPath(); context.arc(0, 0, cw * .33, 0, Math.PI * 2); context.fill();
      context.strokeStyle = spindleOn ? "#50e6ff" : "#758087"; context.lineWidth = 2; for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) { context.beginPath(); context.moveTo(Math.cos(angle)*cw*.33,Math.sin(angle)*ch*.33); context.lineTo(Math.cos(angle)*cw*.58,Math.sin(angle)*ch*.58); context.stroke(); } context.restore();
      context.fillStyle = "rgba(4,8,11,.78)"; context.fillRect(14,14,215,54); context.fillStyle = spindleOn ? "#57edff" : "#7e8a90"; context.font = "700 13px monospace"; context.fillText(spindleOn ? "SPINDLE  8,200 RPM" : "SPINDLE  STOPPED",28,37); context.fillStyle = warning ? "#ff6b40" : "#aab6ba"; context.font = "600 11px monospace"; context.fillText(`LOAD ${Math.round(load)}%  /  TEMP ${Math.round(heat)}C`,28,56);
      frame = requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(frame);
  }, [cutter, heat, load, material, spindleOn, warning]);

  const pointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => { const rect = event.currentTarget.getBoundingClientRect(); return { x: clamp(((event.clientX - rect.left) / rect.width) * GRID_COLS - .5, 0, GRID_COLS - 1), y: clamp(((event.clientY - rect.top) / rect.height) * GRID_ROWS - .5, 0, GRID_ROWS - 1) }; };

  return <main className="game-shell">
    <header className="topbar"><div className="brand"><span>PROJECT</span><strong>TOOLPATH</strong><small>WORKING TITLE / WEB PROTOTYPE 0.1</small></div><div className="shop-stats"><span>SHOP LVL <b>{shopLevel.toString().padStart(2,"0")}</b></span><span>BEST <b>{bestScore}</b></span><span className="credits"><CircleDollarSign size={14}/><b>{credits.toLocaleString()}</b> CR</span></div><button className="icon-button" onClick={() => setMuted((value)=>!value)} aria-label={muted?"Enable sound":"Mute sound"}>{muted?<VolumeX/>:<Volume2/>}</button></header>
    <div className="cockpit">
      <aside className="contract-panel"><div className="panel-label"><span>01</span> ACTIVE CONTRACT</div><p className="client">NORTHSTAR MOBILITY / RUSH</p><h1>Emergency<br/>drive plate</h1><p className="contract-copy">A prototype drivetrain is waiting. Clear the stock, protect the blueprint, and get the plate through inspection.</p><div className="contract-specs"><div><span>Material</span><b>6061 Aluminum</b></div><div><span>Stock</span><b>240 x 140 x 18 mm</b></div><div><span>Par time</span><b>01:15</b></div><div><span>Max reward</span><b>{CONTRACT_REWARD.toLocaleString()} cr</b></div></div><ol className="objectives"><li className={objectiveState>=0?"active":""}><span>1</span><div><b>Start the spindle</b><small>Spacebar or power control</small></div></li><li className={objectiveState>=1?"active":""}><span>2</span><div><b>Machine the profile</b><small>Remove 88% of marked stock</small></div></li><li className={objectiveState>=2?"active":""}><span>3</span><div><b>Inspect the part</b><small>Maximum 3 overcut cells</small></div></li></ol><div className="sim-note"><ShieldAlert size={15}/><span>Game simulation. Not professional machine-operating guidance.</span></div></aside>
      <section className="machine-stage" aria-label="Interactive machining area"><div className="machine-header"><div><i className={spindleOn?"running":""}/><span>VMC-01 / 3-AXIS MILL</span></div><div><span>PROGRAM</span><b>NS-0142-A</b></div><div><span>CYCLE</span><b>{formatTime(elapsed)}</b></div></div><div className={`viewport ${warning?"warning":""}`}><canvas ref={canvasRef} width={960} height={560} aria-label="Machining field. Drag the cutter over material outside the cyan part outline." tabIndex={0} onPointerDown={(event)=>{pointerDown.current=true;event.currentTarget.setPointerCapture(event.pointerId);const p=pointerPosition(event);performCut(p.x,p.y);}} onPointerMove={(event)=>{const p=pointerPosition(event);if(pointerDown.current)performCut(p.x,p.y);else setCutter(p);}} onPointerUp={()=>{pointerDown.current=false;setLoad(0);}} onPointerCancel={()=>{pointerDown.current=false;setLoad(0);}}/><div className="viewport-corner top-left"/><div className="viewport-corner top-right"/><div className="viewport-corner bottom-left"/><div className="viewport-corner bottom-right"/>{warning&&<div className="warning-banner"><Zap size={15}/> MACHINE LOAD WARNING</div>}</div><div className="message-bar" role="status"><i className={message.includes("ERROR")||message.includes("BREAK")?"fault":""}/>{message}</div><div className="controls"><button className={`spindle-button ${spindleOn?"on":""}`} onClick={toggleSpindle} disabled={brokenRef.current}><Power/><span><small>Spindle</small><b>{spindleOn?"STOP":"START"}</b></span></button><label className="feed-control"><span><small>Feed override</small><b>{feed}%</b></span><input type="range" min="25" max="110" value={feed} onChange={(event)=>setFeed(Number(event.target.value))} aria-label="Feed override"/><div><i>SAFE</i><i>FAST</i><i>RISK</i></div></label><button className="inspect-button" onClick={inspect}><Ruler/><span><small>CMM station</small><b>INSPECT PART</b></span></button><button className="reset-button" onClick={()=>resetRun()} aria-label="Restart contract"><RotateCcw/></button></div></section>
      <aside className="telemetry-panel"><div className="panel-label"><span>02</span> LIVE TELEMETRY</div><div className="progress-ring" style={{"--progress":`${completion*3.6}deg`} as React.CSSProperties}><div><strong>{completion}%</strong><span>PROFILE</span></div></div><div className="meters"><Meter icon={<Gauge/>} label="Spindle load" value={load} suffix="%" danger={88}/><Meter icon={<Thermometer/>} label="Tool heat" value={heat} suffix="°C" danger={82}/><Meter icon={<Wrench/>} label="Tool condition" value={tool} suffix="%" inverse danger={25}/></div><div className="quality-readout"><div><span>Dimensional errors</span><b className={overcut>3?"bad":""}>{overcut}</b></div><div><span>Tool replacements</span><b>{toolBreaks}</b></div><div><span>Finish risk</span><b>{finishPenalty<2?"LOW":finishPenalty<6?"MED":"HIGH"}</b></div></div><div className="legend"><p><i className="cyan"/> Cyan line = final part</p><p><i className="silver"/> Silver = material</p><p><i className="dark"/> Dark = removed stock</p><p><i className="red"/> Red edge = overcut</p></div><div className="input-help"><p><MousePointer2/> Drag to cut</p><p><Keyboard/> WASD / arrows to jog</p><p><kbd>SPACE</kbd> spindle</p><p><kbd>I</kbd> inspect</p></div></aside>
    </div>
    <footer className="game-footer"><span>ASSISTED MODE</span><p>Protect the cyan silhouette. Smooth outside passes create a better finish than aggressive plunges.</p><b>NO REAL-WORLD MACHINE VALUES ARE REPRESENTED</b></footer>
    {screen==="brief"&&<div className="modal-backdrop"><section className="contract-modal" role="dialog" aria-modal="true" aria-labelledby="brief-title"><div className="modal-index">CONTRACT 001 / PROTOTYPE RUN</div><div className="modal-grid"><div><p className="client">NORTHSTAR MOBILITY / 02:17 AM</p><h2 id="brief-title">Their test rig<br/>runs at sunrise.</h2><p>A replacement drive plate failed inspection. The team needs one clean prototype before the first road test.</p></div><div className="part-preview" aria-hidden="true"><div className="preview-plate"><i/><i/><i/><i/><b/></div><span>NS-0142-A</span></div></div><div className="brief-cards"><article><b>YOUR JOB</b><p>Cut away everything outside the cyan blueprint.</p></article><article><b>THE CATCH</b><p>Too much feed creates heat, chatter, and tool damage.</p></article><article><b>GET PAID</b><p>Inspect above 88% completion with no more than 3 errors.</p></article></div><button className="accept-button" onClick={()=>resetRun("play")}><span>ACCEPT CONTRACT</span><b>{CONTRACT_REWARD.toLocaleString()} CR MAX</b></button><p className="brief-hint">Pointer, touch, and keyboard supported. Sound begins after you start the spindle.</p></section></div>}
    {screen==="result"&&result&&<div className="modal-backdrop"><section className={`result-modal ${result.accepted?"accepted":"rejected"}`} role="dialog" aria-modal="true" aria-labelledby="result-title"><div className="result-grade"><span>{result.accepted?"PART ACCEPTED":"PART REJECTED"}</span><strong>{result.grade}</strong><small>{result.score} / 100</small></div><div className="result-copy"><p className="client">CMM INSPECTION / NS-0142-A</p><h2 id="result-title">{result.accepted?"You made the deadline.":"The blueprint remembers."}</h2><p>{result.accepted?"Northstar has a test part. Your payout is banked and the shop reputation moved forward.":"The part cannot ship, but the failure is useful. Protect the cyan keep-zone and use a calmer feed next time."}</p><div className="score-grid"><Score label="Geometry" value={`${result.completion}%`}/><Score label="Precision" value={`${result.precision}/30`}/><Score label="Finish" value={`${result.finish}/15`}/><Score label="Time" value={`${result.time}/10`}/></div><div className="payout"><span><Trophy/> Contract payout</span><b>+{result.payout.toLocaleString()} CR</b></div><button className="accept-button" onClick={()=>resetRun("play")}><span>RUN IT AGAIN</span><b>BEAT {Math.max(bestScore,result.score)}</b></button></div></section></div>}
  </main>;
}

function Meter({icon,label,value,suffix,danger,inverse=false}:{icon:React.ReactNode;label:string;value:number;suffix:string;danger:number;inverse?:boolean}){const isDanger=inverse?value<=danger:value>=danger;return <div className={`meter ${isDanger?"danger":""}`}><div className="meter-head"><span>{icon}{label}</span><b>{Math.round(value)}{suffix}</b></div><div className="meter-track"><i style={{width:`${clamp(value,0,100)}%`}}/></div></div>}
function Score({label,value}:{label:string;value:string}){return <div><span>{label}</span><b>{value}</b></div>}
