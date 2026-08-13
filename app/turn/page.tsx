"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Droplets, Gauge, Pause, Play, RotateCcw, StepForward, Target, Wrench } from "lucide-react";
import ModeDock from "../mode-dock";
import TurnPreview, { type TurnPoint } from "./turn-preview";
import styles from "./turn.module.css";

const PROGRAM = `(TURN-01 / AEROSPACE SPACER)
G18 G21 G90 G54
T0101
G97 S1800 M03
M08
G00 X54 Z2
G01 X42 Z0 F0.22
G01 Z-12 F0.18
G01 X32 Z-12 F0.16
G01 Z-28 F0.16
G01 X26 Z-32 F0.12
G00 X60 Z5
M09 M05
M30`;

function parseTurning(source: string) {
  let x = 60, z = 5, spindle = false, coolant = false, feed = .2; const points: TurnPoint[] = [{ x, z, cutting: false, line: 0 }]; const errors: string[] = [];
  source.split("\n").forEach((raw, index) => { const line = raw.replace(/\([^)]*\)/g, "").trim().toUpperCase(), motion = /\bG0?([01])\b/.exec(line)?.[1]; if (!line) return; if (/\bM0?3\b/.test(line)) spindle = true; if (/\bM0?5\b/.test(line)) spindle = false; if (/\bM0?8\b/.test(line)) coolant = true; if (/\bM0?9\b/.test(line)) coolant = false; const xWord = /\bX(-?\d+(?:\.\d+)?)/.exec(line), zWord = /\bZ(-?\d+(?:\.\d+)?)/.exec(line), fWord = /\bF(\d+(?:\.\d+)?)/.exec(line); if (fWord) feed = Number(fWord[1]); if (!motion) return; const nextX = xWord ? Number(xWord[1]) : x, nextZ = zWord ? Number(zWord[1]) : z, cutting = motion === "1" && spindle && nextX < 54; if (motion === "1" && nextX < 54 && !spindle) errors.push(`L${index + 1}: FEED WITH SPINDLE STOPPED`); if (motion === "0" && nextX < 54) errors.push(`L${index + 1}: RAPID INTO TURNING STOCK`); if (cutting && !coolant && nextX < 32) errors.push(`L${index + 1}: DEEP TURNING WITH COOLANT OFF`); const steps = Math.max(1, Math.ceil(Math.hypot(nextX - x, nextZ - z) / 1.5)); for (let step = 1; step <= steps; step += 1) { const t = step / steps; points.push({ x: x + (nextX - x) * t, z: z + (nextZ - z) * t, cutting, line: index + 1 }); } x = nextX; z = nextZ; });
  return { points, errors, spindle, coolant, feed };
}

export default function TurningCell() {
  const [code, setCode] = useState(PROGRAM), [frame, setFrame] = useState(1), [running, setRunning] = useState(false), [message, setMessage] = useState("TURN-01 READY — review X/Z program, then cycle start."); const timer = useRef<number | null>(null); const parsed = useMemo(() => parseTurning(code), [code]); const active = parsed.points[Math.min(frame - 1, parsed.points.length - 1)] ?? parsed.points[0]; const progress = Math.round(frame / Math.max(1, parsed.points.length) * 100);
  useEffect(() => { if (!running) return; timer.current = window.setInterval(() => setFrame((current) => { if (current >= parsed.points.length) { setRunning(false); setMessage(parsed.errors.length ? "TURN HOLD — resolve the controller alarms." : "PART COMPLETE — inspect the turned diameter and shoulder." ); return current; } return current + 1; }), 34); return () => { if (timer.current) window.clearInterval(timer.current); }; }, [parsed.errors.length, parsed.points.length, running]);
  const cycle = () => { if (parsed.errors.length) { setMessage("CONTROLLER ALARM — correct the flagged blocks before cycle start."); return; } if (frame >= parsed.points.length) setFrame(1); setRunning((value) => !value); setMessage(running ? "FEED HOLD — carriage paused." : "CYCLE START — X/Z stock removal live."); };
  return <main className={styles.shell}><header className={styles.header}><div><small>PROJECT TOOLPATH / MACHINE FAMILY 02</small><h1>TURNING CELL</h1></div><div><span>CONTRACT</span><b>AEROSPACE SPACER</b></div><div><span>CONTROL</span><b>G18 / XZ DIAMETER</b></div></header><section className={styles.hero}><div><small>LATHE CONTRACT / LIVE MATERIAL REMOVAL</small><h2>TURN THE<br/><em>PROFILE.</em></h2><p>This is a separate X/Z turning simulation: stock rotates, the tool follows diameter and Z moves, and the workpiece physically steps down as the program runs.</p></div><dl><div><dt>STOCK</dt><dd>Ø54 × 36 MM</dd></div><div><dt>TOOL</dt><dd>T0101 / OD INSERT</dd></div><div><dt>DATUM</dt><dd>G54 / FACE</dd></div></dl></section><section className={styles.workspace}><article className={styles.program}><header><span>LATHE CONTROLLER / O0101</span><span>{code.split("\n").length} BLOCKS</span></header><textarea value={code} spellCheck={false} onChange={(event) => { setCode(event.target.value); setFrame(1); setRunning(false); setMessage("PROGRAM EDITED — controller reset to safe position."); }} aria-label="Turning G-code program"/><footer><span>G18 / XZ PLANE</span><span>G97 / CONSTANT RPM</span><span>G00 G01 / TURN</span></footer></article><article className={styles.stage}><TurnPreview points={parsed.points} frame={frame} spindle={running && parsed.spindle} coolant={running && parsed.coolant} accent="#ffb454"/><div className={styles.telemetry}><span><Gauge/> ØX <b>{active?.x.toFixed(2)}</b></span><span><Target/> Z <b>{active?.z.toFixed(2)}</b></span><span><Wrench/> F <b>{parsed.feed.toFixed(2)}</b></span><span className={running && parsed.coolant ? styles.live : ""}><Droplets/> COOLANT</span></div><p>{message}</p></article><aside className={styles.quality}><header>TURNING QUALITY</header><strong>{parsed.errors.length ? "ALARM" : progress >= 100 ? "READY" : "RUN"}</strong><div><span>PROFILE</span><b>{progress}%</b><i><em style={{ width: `${progress}%` }}/></i></div><dl><div><dt>MODE</dt><dd>G18 X/Z</dd></div><div><dt>SPINDLE</dt><dd>{running ? "1,800 RPM" : "STOP"}</dd></div><div><dt>COOLANT</dt><dd>{running && parsed.coolant ? "ON" : "OFF"}</dd></div><div><dt>ALARMS</dt><dd className={parsed.errors.length ? styles.alarm : ""}>{parsed.errors.length}</dd></div></dl>{parsed.errors.map((error) => <p key={error}>{error}</p>)}</aside></section><section className={styles.transport}><button onClick={() => { setRunning(false); setFrame(1); setMessage("SAFE RESET — tool returned to approach."); }} aria-label="Reset turning cycle"><RotateCcw/></button><button onClick={cycle} className={styles.cycle}>{running ? <Pause/> : <Play/>}{running ? "FEED HOLD" : "CYCLE START"}</button><button onClick={() => { setRunning(false); setFrame((value) => Math.min(parsed.points.length, value + 1)); setMessage("SINGLE BLOCK — one X/Z move."); }} aria-label="Advance one turning block"><StepForward/></button></section><ModeDock/></main>;
}
