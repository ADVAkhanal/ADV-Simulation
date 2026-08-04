"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./asset-pipeline.module.css";

type Vec3 = [number, number, number];
type GlbScene = { vertices: Vec3[]; triangles: [number, number, number][]; generator: string; meshName: string; materialCount: number; bytes: number };
type MachineProfile = { id: string; name: string; shortName: string; process: string; axes: string; tier: string; accent: string; file: string; bytes: number; sha256: string; trainingFocus: string[] };
type MachineManifest = { privacyBoundary: string; assets: MachineProfile[] };
type Gltf = {
  asset?: { generator?: string };
  bufferViews: { byteOffset?: number; byteStride?: number }[];
  accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string }[];
  meshes: { name?: string; primitives: { attributes: { POSITION: number }; indices?: number; mode?: number }[] }[];
  materials?: unknown[];
};

const componentBytes: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const typeWidths: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function readComponent(view: DataView, offset: number, type: number) {
  if (type === 5120) return view.getInt8(offset);
  if (type === 5121) return view.getUint8(offset);
  if (type === 5122) return view.getInt16(offset, true);
  if (type === 5123) return view.getUint16(offset, true);
  if (type === 5125) return view.getUint32(offset, true);
  if (type === 5126) return view.getFloat32(offset, true);
  throw new Error(`Unsupported GLB component type ${type}`);
}

function readAccessor(gltf: Gltf, binary: ArrayBuffer, index: number): number[][] {
  const accessor = gltf.accessors[index], bufferView = gltf.bufferViews[accessor.bufferView];
  const width = typeWidths[accessor.type], componentSize = componentBytes[accessor.componentType];
  if (!width || !componentSize) throw new Error("Unsupported GLB accessor layout");
  const stride = bufferView.byteStride ?? width * componentSize;
  const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const view = new DataView(binary);
  return Array.from({ length: accessor.count }, (_, item) => Array.from(
    { length: width },
    (__, component) => readComponent(view, start + item * stride + component * componentSize, accessor.componentType),
  ));
}

function parseGlb(buffer: ArrayBuffer): GlbScene {
  const header = new DataView(buffer);
  if (header.getUint32(0, true) !== 0x46546c67) throw new Error("Asset is not a binary glTF file");
  if (header.getUint32(4, true) !== 2) throw new Error("Only glTF 2.0 is supported");
  const jsonLength = header.getUint32(12, true);
  if (header.getUint32(16, true) !== 0x4e4f534a) throw new Error("GLB JSON chunk is missing");
  const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength))) as Gltf;
  const binaryHeader = 20 + jsonLength;
  const binary = buffer.slice(binaryHeader + 8, binaryHeader + 8 + header.getUint32(binaryHeader, true));
  const primitive = gltf.meshes?.[0]?.primitives?.[0];
  if (!primitive || (primitive.mode !== undefined && primitive.mode !== 4)) throw new Error("Asset requires one triangle mesh");
  const vertices = readAccessor(gltf, binary, primitive.attributes.POSITION).map((value) => value as Vec3);
  const indices = (primitive.indices === undefined ? vertices.map((_, index) => [index]) : readAccessor(gltf, binary, primitive.indices)).flat();
  const triangles: [number, number, number][] = [];
  for (let index = 0; index + 2 < indices.length; index += 3) triangles.push([indices[index], indices[index + 1], indices[index + 2]]);
  return { vertices, triangles, generator: gltf.asset?.generator ?? "Unknown exporter", meshName: gltf.meshes[0].name ?? "Unnamed mesh", materialCount: gltf.materials?.length ?? 0, bytes: buffer.byteLength };
}

function rgb(hex: string) {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return { r: value >> 16 & 255, g: value >> 8 & 255, b: value & 255 };
}

function drawScene(canvas: HTMLCanvasElement, scene: GlbScene, angleX: number, angleY: number, accent: string) {
  const bounds = canvas.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(bounds.width * ratio)); canvas.height = Math.max(1, Math.round(bounds.height * ratio));
  const context = canvas.getContext("2d"); if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const width = bounds.width, height = bounds.height, color = rgb(accent);
  context.clearRect(0, 0, width, height);
  context.strokeStyle = `rgba(${color.r},${color.g},${color.b},.075)`; context.lineWidth = 1;
  const grid = 36;
  for (let x = width / 2 % grid; x < width; x += grid) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
  for (let y = height / 2 % grid; y < height; y += grid) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }

  const mins: Vec3 = [Infinity, Infinity, Infinity], maxs: Vec3 = [-Infinity, -Infinity, -Infinity];
  scene.vertices.forEach((vertex) => vertex.forEach((value, axis) => { mins[axis] = Math.min(mins[axis], value); maxs[axis] = Math.max(maxs[axis], value); }));
  const center = mins.map((value, axis) => (value + maxs[axis]) / 2) as Vec3;
  const extent = Math.max(...maxs.map((value, axis) => value - mins[axis])) || 1;
  const sinX = Math.sin(angleX), cosX = Math.cos(angleX), sinY = Math.sin(angleY), cosY = Math.cos(angleY);
  const scale = Math.min(width, height) * .78;
  const points = scene.vertices.map((vertex) => {
    const x = (vertex[0] - center[0]) / extent, y = (vertex[1] - center[1]) / extent, z = (vertex[2] - center[2]) / extent;
    const rx = x * cosY + z * sinY, rz = -x * sinY + z * cosY;
    const ry = y * cosX - rz * sinX, rz2 = y * sinX + rz * cosX;
    const perspective = 1 / (1.9 - rz2 * .45);
    return { x: width / 2 + rx * scale * perspective, y: height / 2 - ry * scale * perspective, z: rz2 };
  });
  const faces = scene.triangles.map((triangle) => ({ triangle, depth: triangle.reduce((sum, index) => sum + points[index].z, 0) / 3 })).sort((a, b) => a.depth - b.depth);
  faces.forEach(({ triangle }) => {
    const [a, b, c] = triangle.map((index) => points[index]);
    const signedArea = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const light = Math.max(.10, Math.min(.78, .31 + signedArea / 12000));
    context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.lineTo(c.x, c.y); context.closePath();
    context.fillStyle = `rgba(${color.r},${color.g},${color.b},${light})`; context.fill();
    context.strokeStyle = `rgba(${Math.min(255, color.r + 95)},${Math.min(255, color.g + 95)},${Math.min(255, color.b + 95)},.34)`; context.lineWidth = .55; context.stroke();
  });
}

export default function GlbPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null), sceneRef = useRef<GlbScene | null>(null);
  const rotationRef = useRef({ x: -.38, y: .72, dragging: false, px: 0, py: 0 });
  const [manifest, setManifest] = useState<MachineManifest | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [scene, setScene] = useState<GlbScene | null>(null);
  const [error, setError] = useState("");
  const selected = useMemo(() => manifest?.assets.find((asset) => asset.id === selectedId) ?? manifest?.assets[0], [manifest, selectedId]);

  useEffect(() => {
    fetch("/assets/manifests/machine-capability-kit.json").then((response) => {
      if (!response.ok) throw new Error(`Catalog request failed (${response.status})`); return response.json();
    }).then((catalog: MachineManifest) => { setManifest(catalog); setSelectedId(catalog.assets[0]?.id ?? ""); }).catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setScene(null); sceneRef.current = null; setError("");
    fetch(selected.file, { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error(`Asset request failed (${response.status})`); return response.arrayBuffer();
    }).then(parseGlb).then((loaded) => { sceneRef.current = loaded; setScene(loaded); }).catch((reason: Error) => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, [selected]);

  useEffect(() => {
    let animation = 0, previous = performance.now();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const render = (now: number) => {
      const canvas = canvasRef.current, loaded = sceneRef.current, rotation = rotationRef.current;
      if (canvas && loaded && selected) { if (!rotation.dragging && !reduced) rotation.y += Math.min(now - previous, 40) * .00022; drawScene(canvas, loaded, rotation.x, rotation.y, selected.accent); }
      previous = now; animation = requestAnimationFrame(render);
    };
    animation = requestAnimationFrame(render); return () => cancelAnimationFrame(animation);
  }, [selected]);

  const chooseOffset = (direction: number) => {
    if (!manifest || !selected) return;
    const current = manifest.assets.findIndex((asset) => asset.id === selected.id);
    setSelectedId(manifest.assets[(current + direction + manifest.assets.length) % manifest.assets.length].id);
  };

  return <>
    <nav className={styles.machineRail} aria-label="Machine capability archetypes">
      {manifest?.assets.map((machine, index) => <button key={machine.id} className={machine.id === selected?.id ? styles.selectedMachine : ""} onClick={() => setSelectedId(machine.id)} style={{ "--machine-accent": machine.accent } as React.CSSProperties}>
        <span>{String(index + 1).padStart(2, "0")}</span><b>{machine.shortName}</b><small>{machine.tier}</small>
      </button>)}
    </nav>
    <section className={styles.console} style={{ "--asset-accent": selected?.accent ?? "#51e7ff" } as React.CSSProperties}>
      <div className={styles.viewport}>
        <canvas ref={canvasRef} aria-label={`Interactive preview of ${selected?.name ?? "the selected machine"}`}
          onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); Object.assign(rotationRef.current, { dragging: true, px: event.clientX, py: event.clientY }); }}
          onPointerMove={(event) => { const rotation = rotationRef.current; if (!rotation.dragging) return; rotation.y += (event.clientX - rotation.px) * .009; rotation.x += (event.clientY - rotation.py) * .009; rotation.px = event.clientX; rotation.py = event.clientY; }}
          onPointerUp={() => { rotationRef.current.dragging = false; }}
          onKeyDown={(event) => { if (event.key === "ArrowLeft") chooseOffset(-1); if (event.key === "ArrowRight") chooseOffset(1); }} tabIndex={0} />
        <div className={styles.reticle} aria-hidden="true" />
        <div className={styles.axisMark} aria-hidden="true"><i>X</i><i>Y</i><i>Z</i></div>
        <span className={styles.hint}>DRAG TO ORBIT / ARROW KEYS TO SWITCH</span>
        {!scene && !error && <div className={styles.loading}>DECODING MACHINE GEOMETRY...</div>}
        {error && <div className={styles.error}>PIPELINE FAULT / {error}</div>}
        <div className={styles.sequence}><span className={scene ? styles.complete : ""}>BLEND</span><i/><span className={scene ? styles.complete : ""}>GLB</span><i/><span className={scene ? styles.complete : ""}>DECODE</span><i/><span className={scene ? styles.complete : ""}>INTERACT</span></div>
      </div>
      <aside className={styles.diagnostics}>
        <div className={styles.status}><i className={scene ? styles.online : ""}/><span>{scene ? "ASSET VERIFIED" : error ? "ASSET FAULT" : "VALIDATING"}</span></div>
        <p className={styles.tier}>{selected?.tier ?? "CAPABILITY KIT"}</p>
        <h2>{selected?.name ?? "MACHINE CAPABILITY ATLAS"}</h2>
        <p className={styles.process}>{selected?.process} <span>/</span> {selected?.axes}</p>
        <dl>
          <div><dt>FORMAT</dt><dd>GLB 2.0</dd></div>
          <div><dt>GEOMETRY</dt><dd>{scene ? `${scene.vertices.length.toLocaleString()} VTX / ${scene.triangles.length.toLocaleString()} TRI` : "--"}</dd></div>
          <div><dt>MATERIALS</dt><dd>{scene?.materialCount ?? "--"}</dd></div>
          <div><dt>PAYLOAD</dt><dd>{scene ? `${(scene.bytes / 1024).toFixed(1)} KB` : "--"}</dd></div>
        </dl>
        <div className={styles.focus}><span>TRAINING SIGNALS</span>{selected?.trainingFocus.map((item) => <b key={item}>{item}</b>)}</div>
        <p className={styles.privacy}>{manifest?.privacyBoundary}</p>
      </aside>
    </section>
  </>;
}
