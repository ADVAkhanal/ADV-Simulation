"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./asset-pipeline.module.css";

type Vec3 = [number, number, number];
type ReplicadMesh = { vertices: Float32Array; triangles: Uint32Array | number[] };
type KernelStatus = "idle" | "loading" | "ready" | "error";
type Params = { width: number; depth: number; thickness: number; bore: number };

function clamp(value: number, min = 0, max = 1) { return Math.max(min, Math.min(max, value)); }

// A single-solid Canvas 2D projector, deliberately independent of
// flagship-machining-kit.tsx's GLB/hierarchy renderer: this is one plain
// triangle soup straight out of a CAD kernel mesh, not a node hierarchy.
function draw(canvas: HTMLCanvasElement, mesh: ReplicadMesh | null, view: { yaw: number; pitch: number; zoom: number }, time: number) {
  const bounds = canvas.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(bounds.width * ratio)); canvas.height = Math.max(1, Math.round(bounds.height * ratio));
  const context = canvas.getContext("2d"); if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, bounds.width, bounds.height);
  const bg = context.createLinearGradient(0, 0, bounds.width, bounds.height); bg.addColorStop(0, "#14323b"); bg.addColorStop(1, "#05090b");
  context.fillStyle = bg; context.fillRect(0, 0, bounds.width, bounds.height);
  if (!mesh) return;

  const positions = mesh.vertices, indices = mesh.triangles;
  const triCount = indices.length / 3;
  const points: Vec3[] = [];
  for (let i = 0; i < positions.length; i += 3) points.push([positions[i], positions[i + 1], positions[i + 2]]);
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  points.forEach((point) => point.forEach((value, axis) => { min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value); }));
  const center = min.map((value, axis) => (value + max[axis]) / 2) as Vec3, extent = Math.max(...max.map((value, axis) => value - min[axis])) || 1;

  const project = (point: Vec3) => {
    const nx = (point[0] - center[0]) / extent, ny = (point[1] - center[1]) / extent, nz = (point[2] - center[2]) / extent;
    const yaw = view.yaw, pitch = view.pitch;
    const rx = nx * Math.cos(yaw) + ny * Math.sin(yaw), ry = -nx * Math.sin(yaw) + ny * Math.cos(yaw);
    const rz = nz * Math.cos(pitch) - ry * Math.sin(pitch), depth = nz * Math.sin(pitch) + ry * Math.cos(pitch);
    const perspective = 1 / (1.8 - depth * .4), scale = Math.min(bounds.width, bounds.height) * .78 * view.zoom;
    return { x: bounds.width / 2 + rx * scale * perspective, y: bounds.height / 2 - rz * scale * perspective, depth };
  };

  const faces: { points: ReturnType<typeof project>[]; depth: number; light: number }[] = [];
  for (let t = 0; t < triCount; t += 1) {
    const a = points[indices[t * 3]], b = points[indices[t * 3 + 1]], c = points[indices[t * 3 + 2]];
    if (!a || !b || !c) continue;
    const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normal: Vec3 = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const magnitude = Math.hypot(...normal) || 1, lightDir: Vec3 = [-.3, -.5, .8];
    const light = clamp(.32 + Math.abs((normal[0] * lightDir[0] + normal[1] * lightDir[1] + normal[2] * lightDir[2]) / magnitude) * .68);
    const projected = [a, b, c].map(project);
    faces.push({ points: projected, depth: (projected[0].depth + projected[1].depth + projected[2].depth) / 3, light });
  }
  faces.sort((x, y) => x.depth - y.depth);
  faces.forEach(({ points: pts, light }) => {
    context.beginPath(); context.moveTo(pts[0].x, pts[0].y); context.lineTo(pts[1].x, pts[1].y); context.lineTo(pts[2].x, pts[2].y); context.closePath();
    const value = Math.round(clamp(120 + light * 120, 0, 255));
    context.fillStyle = `rgb(${Math.round(value * .55)},${value},${Math.round(value * 1.05)})`;
    context.fill();
    context.strokeStyle = "rgba(220,245,248,.14)"; context.lineWidth = .4; context.stroke();
  });
  void time;
}

export default function ParametricGenerator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const meshRef = useRef<ReplicadMesh | null>(null);
  const kernelRef = useRef<{ makeBox: (...args: unknown[]) => unknown; makeCylinder: (...args: unknown[]) => unknown } | null>(null);
  const viewRef = useRef({ yaw: -.6, pitch: -.32, zoom: 1 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [kernelStatus, setKernelStatus] = useState<KernelStatus>("idle");
  const [error, setError] = useState("");
  const [params, setParams] = useState<Params>({ width: 60, depth: 40, thickness: 6, bore: 8 });
  const [stats, setStats] = useState<{ triangles: number; vertices: number; ms: number } | null>(null);

  useEffect(() => {
    let frame = 0;
    const render = (time: number) => { const canvas = canvasRef.current; if (canvas) draw(canvas, meshRef.current, viewRef.current, time); frame = requestAnimationFrame(render); };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  const generate = (nextParams: Params) => {
    const kernel = kernelRef.current; if (!kernel) return;
    const start = performance.now();
    const plate = kernel.makeBox([-nextParams.width / 2, -nextParams.depth / 2, 0], [nextParams.width / 2, nextParams.depth / 2, nextParams.thickness]) as { cut: (other: unknown) => { mesh: (options: { tolerance: number }) => ReplicadMesh } };
    const solid = nextParams.bore > 0
      ? plate.cut(kernel.makeCylinder(nextParams.bore / 2, nextParams.thickness + 4, [0, 0, -2]))
      : plate;
    const mesh = solid.mesh({ tolerance: .15 });
    meshRef.current = mesh;
    setStats({ triangles: mesh.triangles.length / 3, vertices: mesh.vertices.length / 3, ms: Math.round(performance.now() - start) });
  };

  const updateParam = (key: keyof Params, value: number) => {
    const next = { ...params, [key]: value };
    setParams(next);
    generate(next);
  };

  const loadKernel = async () => {
    if (kernelStatus === "loading") return;
    setKernelStatus("loading"); setError("");
    try {
      const [replicad, factoryModule, wasmUrlModule] = await Promise.all([
        import("replicad"),
        import("replicad-opencascadejs/src/replicad_single.js"),
        // Vite's ?url suffix resolves this to the built asset's URL instead
        // of trying to parse the binary as JS - this only ever runs client
        // side, so it never touches the server/Worker bundle.
        // @ts-expect-error -- Vite-specific query-suffix import has no ambient type
        import("replicad-opencascadejs/src/replicad_single.wasm?url"),
      ]);
      const factory = (factoryModule as { default?: unknown }).default ?? factoryModule;
      const wasmUrl = (wasmUrlModule as { default?: string }).default ?? (wasmUrlModule as unknown as string);
      const OC = await (factory as (options: { locateFile: () => string }) => Promise<unknown>)({ locateFile: () => wasmUrl });
      replicad.setOC(OC as never);
      kernelRef.current = { makeBox: replicad.makeBox as never, makeCylinder: replicad.makeCylinder as never };
      setKernelStatus("ready");
      generate(params);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kernel failed to load.");
      setKernelStatus("error");
    }
  };

  return <section className={styles.kitInspector}>
    <div className={styles.kitViewport}>
      <canvas
        ref={canvasRef}
        aria-label="Live parametric CAD solid, generated by a real OpenCASCADE boolean cut"
        style={{ display: "block", width: "100%", height: "100%", cursor: kernelStatus === "ready" ? "grab" : "default" }}
        onPointerDown={(event) => { if (kernelStatus !== "ready") return; dragRef.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => { const start = dragRef.current; if (!start) return; viewRef.current.yaw += (event.clientX - start.x) * .008; viewRef.current.pitch = clamp(viewRef.current.pitch + (event.clientY - start.y) * .006, -1.4, 1.4); dragRef.current = { x: event.clientX, y: event.clientY }; }}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }}
        onWheel={(event) => { if (kernelStatus !== "ready") return; event.preventDefault(); viewRef.current.zoom = clamp(viewRef.current.zoom - event.deltaY * .001, .5, 2.2); }}
      />
      {kernelStatus !== "ready" && <div className={styles.errorText} style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
        {kernelStatus === "idle" && <span>Load the CAD kernel to generate a live solid.</span>}
        {kernelStatus === "loading" && <span>Downloading OpenCASCADE WASM kernel…</span>}
        {kernelStatus === "error" && <span>{error || "Kernel failed to load."}</span>}
      </div>}
    </div>
    <aside className={styles.kitData}>
      <span className={styles.kicker}>REAL B-REP GEOMETRY / OPENCASCADE WASM</span>
      <h2>PARAMETRIC<br/>GENERATOR</h2>
      <p style={{ color: "#93a6ab", fontSize: 13, lineHeight: 1.6, margin: "10px 0 18px" }}>
        A genuine boolean cut through an OpenCASCADE kernel (replicad), not a distance-function approximation - the same category of geometry engine behind real CAD software. Runs entirely in your browser.
      </p>
      {kernelStatus !== "ready" ? (
        <button onClick={loadKernel} style={{ width: "100%", padding: "14px 0", color: "#071014", background: "#50e6ff", border: 0, font: "800 12px var(--font-mono), monospace", letterSpacing: ".08em", cursor: kernelStatus === "loading" ? "wait" : "pointer" }}>
          {kernelStatus === "loading" ? "LOADING KERNEL…" : kernelStatus === "error" ? "RETRY — LOAD CAD KERNEL (~23 MB)" : "LOAD CAD KERNEL (~23 MB)"}
        </button>
      ) : <>
        <label style={{ display: "block", margin: "14px 0", color: "#93a6ab", font: "700 12px var(--font-mono), monospace" }}>WIDTH <b style={{ color: "#dcecef" }}>{params.width} MM</b>
          <input type="range" min={30} max={120} value={params.width} onChange={(event) => updateParam("width", Number(event.target.value))} style={{ display: "block", width: "100%", marginTop: 6 }}/>
        </label>
        <label style={{ display: "block", margin: "14px 0", color: "#93a6ab", font: "700 12px var(--font-mono), monospace" }}>DEPTH <b style={{ color: "#dcecef" }}>{params.depth} MM</b>
          <input type="range" min={20} max={90} value={params.depth} onChange={(event) => updateParam("depth", Number(event.target.value))} style={{ display: "block", width: "100%", marginTop: 6 }}/>
        </label>
        <label style={{ display: "block", margin: "14px 0", color: "#93a6ab", font: "700 12px var(--font-mono), monospace" }}>THICKNESS <b style={{ color: "#dcecef" }}>{params.thickness} MM</b>
          <input type="range" min={2} max={20} value={params.thickness} onChange={(event) => updateParam("thickness", Number(event.target.value))} style={{ display: "block", width: "100%", marginTop: 6 }}/>
        </label>
        <label style={{ display: "block", margin: "14px 0", color: "#93a6ab", font: "700 12px var(--font-mono), monospace" }}>BORE DIAMETER <b style={{ color: "#dcecef" }}>{params.bore} MM</b>
          <input type="range" min={0} max={24} value={params.bore} onChange={(event) => updateParam("bore", Number(event.target.value))} style={{ display: "block", width: "100%", marginTop: 6 }}/>
        </label>
        <dl><div><dt>TRIANGLES</dt><dd>{stats?.triangles.toLocaleString() ?? "—"}</dd></div><div><dt>VERTICES</dt><dd>{stats?.vertices.toLocaleString() ?? "—"}</dd></div><div><dt>GENERATED IN</dt><dd>{stats ? `${stats.ms} ms` : "—"}</dd></div><div><dt>KERNEL</dt><dd>OPENCASCADE / WASM</dd></div></dl>
      </>}
      {error && kernelStatus === "ready" && <p className={styles.errorText}>{error}</p>}
    </aside>
  </section>;
}
