"use client";

import type { ToolPoint } from "./gcode-engine";
import styles from "./part-preview.module.css";

type Props = { points: ToolPoint[]; frame: number; accent: string; material: string; tool: number; passes: number; finalDepth: number };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function project(point: ToolPoint, depth = 0) {
  const x = 128 + point.x * 8.1 - point.y * 3.25;
  const y = 220 + point.x * 2.15 + point.y * 1.88 - depth * 15;
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}

export default function PartPreview({ points, frame, accent, material, tool, passes, finalDepth }: Props) {
  const visible = points.slice(0, Math.max(1, frame));
  const cut = visible.filter((point) => point.cut && point.z < 0);
  const head = visible.at(-1) ?? points[0] ?? { x: 0, y: 0, z: 5, cut: false, line: 0, feed: 0 };
  const liveDepth = clamp(Math.abs(head.z), 0, Math.abs(finalDepth));
  const path = cut.map((point) => project(point, Math.abs(point.z))).join(" ");
  const trace = points.filter((point) => point.cut && point.z < 0).map((point) => project(point, Math.abs(point.z))).join(" ");
  const toolPoint = project(head, Math.max(0, liveDepth));
  const completed = Math.round(cut.length / Math.max(1, points.filter((point) => point.cut).length) * 100);

  return <div className={styles.preview} aria-label="Live isometric part preview generated from the current G-code path">
    <svg viewBox="0 0 520 360" role="img" aria-label={`Machined ${material} part preview, ${completed}% complete`}>
      <defs>
        <linearGradient id="stock" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#eff8fa"/><stop offset=".46" stopColor="#718b93"/><stop offset="1" stopColor="#23383f"/></linearGradient>
        <linearGradient id="front" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#506871"/><stop offset="1" stopColor="#122127"/></linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <clipPath id="top"><polygon points="128,220 452,306 323,354 0,267"/></clipPath>
      </defs>
      <g className={styles.grid} opacity=".52"><path d="M128 220 452 306 323 354 0 267Z"/><path d="M52 238 376 324M105 252 429 338M77 235 205 283M142 252 270 300M207 269 335 317"/></g>
      <polygon className={styles.front} points="0,267 323,354 323,330 0,243"/>
      <polygon className={styles.side} points="323,354 452,306 452,282 323,330"/>
      <polygon className={styles.top} points="128,196 452,282 323,330 0,243"/>
      <g clipPath="url(#top)">
        <polyline className={styles.future} points={trace}/>
        {path && <polyline className={styles.cut} points={path} style={{ stroke: accent }}/>} 
      </g>
      <g className={styles.tool} transform={`translate(${toolPoint})`} style={{ color: accent }}>
        <line x1="0" y1="-78" x2="0" y2="-14"/><rect x="-10" y="-92" width="20" height="25" rx="3"/><circle r="12" cy="-5"/><circle r="4" cy="-5" fill="currentColor" filter="url(#glow)"/>
      </g>
      <g className={styles.callout}><text x="24" y="38">LIVE PART / SIM</text><text x="24" y="58">{material.toUpperCase()} · T{tool} · {passes} PASS</text><text x="24" y="327">Z {head.z.toFixed(2)} MM</text><text x="24" y="345">{completed}% TOOLPATH EXECUTED</text></g>
    </svg>
    <div className={styles.caption}><span><i style={{ background: accent }}/> CUT PATH</span><span>SCROLL PAGE NORMALLY</span></div>
  </div>;
}
