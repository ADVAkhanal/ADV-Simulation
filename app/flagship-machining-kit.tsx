"use client";

import { useEffect, useRef, useState } from "react";
import { trackAnonymous } from "./anonymous-analytics";
import styles from "./flagship-machining-kit.module.css";

type Vec3 = [number, number, number];
type Mat4 = [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
type Face = { vertices: [Vec3, Vec3, Vec3]; color: string; node: string; metallic: number; roughness: number };
type Scene = { faces: Face[]; bytes: number };
type Props = { cursor: { x: number; y: number }; spindle: boolean; completion: number; load: number; variant?: "mini" | "full"; material?: string; accent?: string; verbose?: boolean };
type ViewState = { yaw: number; pitch: number; zoom: number; autoOrbit: boolean };

const colors = ["#24353a", "#4ae2fa", "#778b90", "#c6d4d6", "#6a7c81", "#18252a"];
const STOCK_MATERIAL_COLORS: Record<string, string> = { "6061 AL": "rgb(174,190,194)", "7075-T6": "rgb(182,196,168)", "Ti-6Al-4V": "rgb(146,156,168)" };
function stockMaterialColor(material?: string) { return (material && STOCK_MATERIAL_COLORS[material]) || STOCK_MATERIAL_COLORS["6061 AL"]; }

function clamp(value: number, min = 0, max = 1) { return Math.max(min, Math.min(max, value)); }
function shade(color: string, light: number, metallic: number) {
  const values = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [92, 112, 118];
  const specular = Math.pow(clamp(light), 6) * metallic * 92;
  return `rgb(${values.map((value) => Math.round(clamp(value * (.42 + light * .9) + specular, 0, 255))).join(",")})`;
}
function faceLight(vertices: [Vec3, Vec3, Vec3]) {
  const [a, b, c] = vertices, ab = b.map((value, axis) => value - a[axis]) as Vec3, ac = c.map((value, axis) => value - a[axis]) as Vec3;
  const normal: Vec3 = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  const magnitude = Math.hypot(...normal) || 1, light: Vec3 = [-.35, .82, .45];
  return clamp(.28 + Math.abs((normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2]) / magnitude) * .72);
}

function components(type: string) { return type === "VEC2" ? 2 : type === "VEC3" ? 3 : type === "VEC4" ? 4 : 1; }
function reader(componentType: number) {
  if (componentType === 5121) return { bytes: 1, get: (view: DataView, offset: number) => view.getUint8(offset) };
  if (componentType === 5123) return { bytes: 2, get: (view: DataView, offset: number) => view.getUint16(offset, true) };
  if (componentType === 5125) return { bytes: 4, get: (view: DataView, offset: number) => view.getUint32(offset, true) };
  if (componentType === 5126) return { bytes: 4, get: (view: DataView, offset: number) => view.getFloat32(offset, true) };
  throw new Error(`Unsupported GLB component ${componentType}`);
}

const identity: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function multiply(a: Mat4, b: Mat4): Mat4 {
  const result = Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) for (let row = 0; row < 4; row += 1) {
    for (let axis = 0; axis < 4; axis += 1) result[column * 4 + row] += a[axis * 4 + row] * b[column * 4 + axis];
  }
  return result as Mat4;
}
function nodeMatrix(node: { matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }): Mat4 {
  if (node.matrix) return node.matrix as Mat4;
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1], [sx, sy, sz] = node.scale ?? [1, 1, 1], [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [(1 - 2 * (yy + zz)) * sx, (2 * (xy + wz)) * sx, (2 * (xz - wy)) * sx, 0,
    (2 * (xy - wz)) * sy, (1 - 2 * (xx + zz)) * sy, (2 * (yz + wx)) * sy, 0,
    (2 * (xz + wy)) * sz, (2 * (yz - wx)) * sz, (1 - 2 * (xx + yy)) * sz, 0,
    tx, ty, tz, 1];
}
function transform(point: Vec3, matrix: Mat4): Vec3 {
  return [point[0] * matrix[0] + point[1] * matrix[4] + point[2] * matrix[8] + matrix[12], point[0] * matrix[1] + point[1] * matrix[5] + point[2] * matrix[9] + matrix[13], point[0] * matrix[2] + point[1] * matrix[6] + point[2] * matrix[10] + matrix[14]];
}

function parseGlb(buffer: ArrayBuffer): Scene {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) throw new Error("Invalid GLB header");
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(buffer.slice(20, 20 + jsonLength)));
  const binaryStart = 20 + jsonLength + 8;
  const binary = new DataView(buffer, binaryStart);
  const readAccessor = (index: number) => {
    const accessor = json.accessors[index], bufferView = json.bufferViews[accessor.bufferView];
    const item = reader(accessor.componentType), size = components(accessor.type);
    const stride = bufferView.byteStride ?? item.bytes * size;
    const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    return Array.from({ length: accessor.count }, (_, row) => Array.from({ length: size }, (__, column) => item.get(binary, start + row * stride + column * item.bytes)));
  };
  const faces: Face[] = [];
  const walk = (nodeIndex: number, parent: Mat4) => {
    const node = json.nodes[nodeIndex], world = multiply(parent, nodeMatrix(node));
    if (node.mesh !== undefined) for (const primitive of json.meshes[node.mesh].primitives) {
      const positions = readAccessor(primitive.attributes.POSITION) as Vec3[];
      const indices = primitive.indices === undefined ? positions.map((_, index) => [index]) : readAccessor(primitive.indices);
      const material = json.materials?.[primitive.material ?? 0];
      const pbr = material?.pbrMetallicRoughness, base = pbr?.baseColorFactor;
      const color = base ? `rgb(${base.slice(0, 3).map((value: number) => Math.round(value * 255)).join(",")})` : colors[(primitive.material ?? 0) % colors.length];
      for (let index = 0; index + 2 < indices.length; index += 3) {
        const triangle = [indices[index][0], indices[index + 1][0], indices[index + 2][0]];
        faces.push({ node: node.name, color, metallic: pbr?.metallicFactor ?? .72, roughness: pbr?.roughnessFactor ?? .34, vertices: triangle.map((vertex) => transform(positions[vertex], world)) as [Vec3, Vec3, Vec3] });
      }
    }
    for (const child of node.children ?? []) walk(child, world);
  };
  const roots = json.scenes?.[json.scene ?? 0]?.nodes ?? json.nodes.map((_: unknown, index: number) => index);
  roots.forEach((node: number) => walk(node, identity));
  if (!faces.length) throw new Error("GLB contains no drawable faces");
  return { faces, bytes: buffer.byteLength };
}

function draw(canvas: HTMLCanvasElement, scene: Scene | null, props: Props, fallback: boolean, view: ViewState, time: number, reducedMotion: boolean) {
  const bounds = canvas.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(bounds.width * ratio)); canvas.height = Math.max(1, Math.round(bounds.height * ratio));
  const context = canvas.getContext("2d"); if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, bounds.width, bounds.height);
  const bg = context.createLinearGradient(0, 0, bounds.width, bounds.height); bg.addColorStop(0, "#1c3036"); bg.addColorStop(.52, "#0a1519"); bg.addColorStop(1, "#030709");
  context.fillStyle = bg; context.fillRect(0, 0, bounds.width, bounds.height);
  const inspectionLight = context.createRadialGradient(bounds.width * .24, bounds.height * .12, 0, bounds.width * .24, bounds.height * .12, bounds.width * .78);
  inspectionLight.addColorStop(0, "#e7fbff38"); inspectionLight.addColorStop(.5, "#50d8ee12"); inspectionLight.addColorStop(1, "#00000000"); context.fillStyle = inspectionLight; context.fillRect(0, 0, bounds.width, bounds.height);
  const horizon = bounds.height * .71, vanishingX = bounds.width * .46;
  context.strokeStyle = "#8bb2ba16"; context.lineWidth = 1;
  for (let lane = -7; lane <= 7; lane += 1) { context.beginPath(); context.moveTo(vanishingX, horizon); context.lineTo(vanishingX + lane * bounds.width * .12, bounds.height); context.stroke(); }
  for (let step = 1; step <= 8; step += 1) { const y = horizon + Math.pow(step / 8, 1.7) * (bounds.height - horizon); context.beginPath(); context.moveTo(0, y); context.lineTo(bounds.width, y); context.stroke(); }
  if (!scene || fallback) {
    context.fillStyle = "#1d3036"; context.fillRect(bounds.width * .08, bounds.height * .72, bounds.width * .84, bounds.height * .12);
    context.fillStyle = "#35494f"; context.fillRect(bounds.width * .24, bounds.height * .57, bounds.width * .52, bounds.height * .16);
    context.fillStyle = "#a8babd"; context.fillRect(bounds.width * .34, bounds.height * .49, bounds.width * .32, bounds.height * .1);
    const x = bounds.width * (.34 + props.cursor.x / 27 * .32), y = bounds.height * (.18 + props.cursor.y / 15 * .24);
    context.strokeStyle = props.spindle ? "#00aeef" : "#759096"; context.lineWidth = 8; context.beginPath(); context.moveTo(x, 0); context.lineTo(x, y); context.stroke();
    return;
  }
  const all = scene.faces.flatMap((face) => face.vertices);
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  all.forEach((point) => point.forEach((value, axis) => { min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value); }));
  const center = min.map((value, axis) => (value + max[axis]) / 2) as Vec3, extent = Math.max(...max.map((value, axis) => value - min[axis])) || 1;
  const toolX = (props.cursor.x / 27 - .5) * 230, toolZ = (props.cursor.y / 15 - .5) * 120;
  const orbit = view.autoOrbit && !reducedMotion ? time / (props.variant === "full" ? 15000 : 24000) : 0;
  const project = (point: Vec3, node: string) => {
    let [x, y, z] = point;
    if (node.startsWith("machine.spindle") || node.startsWith("machine.coolant") || node.startsWith("tool.endmill")) { x += toolX; z += toolZ; y += props.spindle ? -22 : 0; }
    const nx = (x - center[0]) / extent, ny = (y - center[1]) / extent, nz = (z - center[2]) / extent;
    const yaw = view.yaw + orbit, pitch = view.pitch, rx = nx * Math.cos(yaw) + nz * Math.sin(yaw), rz = -nx * Math.sin(yaw) + nz * Math.cos(yaw);
    const ry = ny * Math.cos(pitch) - rz * Math.sin(pitch), depth = ny * Math.sin(pitch) + rz * Math.cos(pitch);
    const perspective = 1 / (1.7 - depth * .42), scale = Math.min(bounds.width, bounds.height) * .96 * view.zoom;
    return { x: bounds.width / 2 + rx * scale * perspective, y: bounds.height * .54 - ry * scale * perspective, depth };
  };
  const averagePoint = (node: string): Vec3 => {
    const points = scene.faces.filter((face) => face.node === node).flatMap((face) => face.vertices);
    if (!points.length) return [0, 0, 0];
    return points.reduce<Vec3>((sum, point) => [sum[0] + point[0] / points.length, sum[1] + point[1] / points.length, sum[2] + point[2] / points.length], [0, 0, 0]);
  };
  const cutter = project(averagePoint("tool.endmill.flat.010"), "tool.endmill.flat.010");
  const coolant = project(averagePoint("machine.coolant.manifold"), "machine.coolant.manifold");
  const stockPoints = scene.faces.filter((face) => face.node === "stock.block.flagship").flatMap((face) => face.vertices).map((point) => project(point, "stock.block.flagship"));
  const stockScreen = stockPoints.length ? {
    left: Math.min(...stockPoints.map((point) => point.x)), right: Math.max(...stockPoints.map((point) => point.x)),
    top: Math.min(...stockPoints.map((point) => point.y)), bottom: Math.max(...stockPoints.map((point) => point.y)),
  } : null;
  context.save(); context.filter = "blur(10px)"; context.globalAlpha = .62; context.fillStyle = "#000"; context.beginPath(); context.ellipse(bounds.width * .49, bounds.height * .77, bounds.width * .34, bounds.height * .075, -.02, 0, Math.PI * 2); context.fill(); context.restore();
  if (props.spindle) {
    const workGlow = context.createRadialGradient(cutter.x, cutter.y, 0, cutter.x, cutter.y, Math.max(54, bounds.width * .09));
    workGlow.addColorStop(0, `rgba(255,175,78,${.3 + props.load / 330})`); workGlow.addColorStop(.25, "rgba(80,230,255,.16)"); workGlow.addColorStop(1, "rgba(0,0,0,0)");
    context.save(); context.globalCompositeOperation = "screen"; context.fillStyle = workGlow; context.fillRect(0, 0, bounds.width, bounds.height); context.restore();
  }
  const projected = scene.faces.map((face) => ({ face, points: face.vertices.map((point) => project(point, face.node)), depth: face.vertices.reduce((sum, point) => sum + project(point, face.node).depth, 0) / 3 })).sort((a, b) => a.depth - b.depth);
  projected.forEach(({ face, points }) => {
    context.beginPath(); context.moveTo(points[0].x, points[0].y); context.lineTo(points[1].x, points[1].y); context.lineTo(points[2].x, points[2].y); context.closePath();
    const illumination = faceLight(face.vertices), depthFade = clamp(.78 + points[0].depth * .16, .58, 1);
    const isStock = face.node.includes("stock"), isTool = face.node.startsWith("tool.endmill"), isSpindle = face.node.includes("spindle"), isFixture = face.node.includes("vise") || face.node.includes("fixture") || face.node.includes("jaw"), isWorklight = face.node.includes("worklight"), isEnclosure = face.node.includes("enclosure");
    const materialColor = isStock ? stockMaterialColor(props.material) : isFixture ? "rgb(79,101,108)" : isSpindle ? "rgb(65,84,91)" : isEnclosure ? "rgb(37,49,54)" : face.color;
    context.globalAlpha = (isStock ? Math.max(.34, 1 - props.completion / 135) : .98) * depthFade;
    context.fillStyle = isTool && props.spindle ? "#7ff1ff" : isWorklight ? "#ff9b3f" : shade(materialColor, illumination, face.metallic); context.fill();
    context.strokeStyle = isTool ? "#e8fdff" : isStock ? "rgba(235,250,252,.28)" : `rgba(208,232,236,${.08 + (1 - face.roughness) * .11})`; context.lineWidth = isTool ? 1.15 : isStock ? .65 : .45; context.stroke();
  });
  context.globalAlpha = 1;
  if (stockScreen && props.completion > 0) {
    const width = stockScreen.right - stockScreen.left, depth = Math.max(4, (stockScreen.bottom - stockScreen.top) * .34);
    context.save(); context.beginPath(); context.rect(stockScreen.left, stockScreen.bottom - depth, width * clamp(props.completion / 100), depth); context.clip();
    const floor = context.createLinearGradient(stockScreen.left, 0, stockScreen.right, 0); floor.addColorStop(0, "#294b54"); floor.addColorStop(.45, "#92a9ad"); floor.addColorStop(1, "#233b42");
    context.fillStyle = floor; context.fillRect(stockScreen.left, stockScreen.bottom - depth, width, depth);
    context.strokeStyle = "rgba(218,245,248,.22)"; context.lineWidth = .7;
    for (let x = stockScreen.left - depth; x < stockScreen.right + depth; x += 7) { context.beginPath(); context.moveTo(x, stockScreen.bottom); context.lineTo(x + depth, stockScreen.bottom - depth); context.stroke(); }
    context.restore();
  }
  if (props.spindle) {
    const pulse = .48 + Math.sin(time / 65) * .14, phase = reducedMotion ? 0 : time * .032;
    context.save(); context.globalCompositeOperation = "screen";
    context.strokeStyle = `rgba(128,241,255,${pulse})`; context.lineWidth = 1.2; context.beginPath(); context.ellipse(cutter.x, cutter.y, 15 + props.load * .05, 5 + props.load * .018, 0, 0, Math.PI * 2); context.stroke();
    for (let blade = 0; blade < 3; blade += 1) { const angle = phase + blade * Math.PI * 2 / 3; context.strokeStyle = "rgba(226,253,255,.72)"; context.beginPath(); context.moveTo(cutter.x, cutter.y); context.lineTo(cutter.x + Math.cos(angle) * 14, cutter.y + Math.sin(angle) * 5); context.stroke(); }
    for (const side of [-1, 1]) { context.strokeStyle = "rgba(93,225,244,.34)"; context.lineWidth = 1.1; context.beginPath(); context.moveTo(coolant.x + side * 8, coolant.y); context.quadraticCurveTo((coolant.x + cutter.x) / 2 + side * 15, cutter.y - 12, cutter.x + side * 5, cutter.y); context.stroke(); }
    const chips = props.variant === "full" ? 20 : 9;
    for (let index = 0; index < chips; index += 1) { const age = ((time / 720 + index * .173) % 1), angle = -2.7 + (index % 7) * .23; const reach = (18 + (index % 5) * 7) * age; const x = cutter.x + Math.cos(angle) * reach, y = cutter.y + Math.sin(angle) * reach + age * age * 26; context.fillStyle = index % 4 ? `rgba(205,230,232,${1 - age})` : `rgba(255,178,80,${.8 - age * .7})`; context.fillRect(x, y, 1.5 + (index % 2), .8); }
    context.restore();
  }
  const vignette = context.createRadialGradient(bounds.width / 2, bounds.height / 2, Math.min(bounds.width, bounds.height) * .25, bounds.width / 2, bounds.height / 2, Math.max(bounds.width, bounds.height) * .7);
  vignette.addColorStop(0, "#00000000"); vignette.addColorStop(1, "#00000080"); context.fillStyle = vignette; context.fillRect(0, 0, bounds.width, bounds.height);
}

export default function FlagshipMachiningKit(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null), sceneRef = useRef<Scene | null>(null), propsRef = useRef(props);
  const viewRef = useRef<ViewState>({ yaw: -.72, pitch: -.42, zoom: 1, autoOrbit: true });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const reducedMotionRef = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [autoOrbit, setAutoOrbit] = useState(true);
  propsRef.current = props;
  viewRef.current.autoOrbit = autoOrbit;
  useEffect(() => { reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches; }, []);
  useEffect(() => {
    const controller = new AbortController();
    const forced = new URLSearchParams(location.search).has("assetFallback");
    if (forced) { setStatus("fallback"); trackAnonymous("asset_fallback", { asset: "machining-kit-v1", reason: "forced" }); return () => controller.abort(); }
    fetch("/assets/workholding/toolpath-machining-kit-v1.glb", { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.arrayBuffer();
    }).then(parseGlb).then((scene) => { sceneRef.current = scene; setStatus("ready"); trackAnonymous("asset_ready", { asset: "machining-kit-v1", kb: Math.round(scene.bytes / 1024) }); }).catch((reason: Error) => {
      if (reason.name === "AbortError") return;
      console.error("toolpath.asset_load_error", { assetId: "toolpath.machining-kit.v1", reason: reason.message });
      setStatus("fallback"); trackAnonymous("asset_fallback", { asset: "machining-kit-v1", reason: "load" });
    });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    let frame = 0;
    const render = (time: number) => { const canvas = canvasRef.current; if (canvas) draw(canvas, sceneRef.current, propsRef.current, status === "fallback", viewRef.current, time, reducedMotionRef.current); frame = requestAnimationFrame(render); };
    frame = requestAnimationFrame(render); return () => cancelAnimationFrame(frame);
  }, [status]);
  const resetView = () => { viewRef.current = { yaw: -.72, pitch: -.42, zoom: 1, autoOrbit: true }; setAutoOrbit(true); trackAnonymous("twin_view_reset", { surface: props.variant ?? "mini" }); };
  return <aside className={`${styles.kit} ${props.variant === "full" ? styles.full : ""}`} aria-label="Live 3D machining kit visualization">
    <canvas ref={canvasRef} tabIndex={props.variant === "full" ? 0 : -1} aria-label={props.variant === "full" ? "Interactive 3D machine assembly. Drag to orbit and use the mouse wheel to zoom." : "Live 3D machine assembly preview"} onPointerDown={(event) => { if (props.variant !== "full") return; dragRef.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); setAutoOrbit(false); }} onPointerMove={(event) => { const start = dragRef.current; if (!start || props.variant !== "full") return; viewRef.current.yaw += (event.clientX - start.x) * .008; viewRef.current.pitch = clamp(viewRef.current.pitch + (event.clientY - start.y) * .006, -.95, .2); dragRef.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }} onWheel={(event) => { if (props.variant !== "full") return; event.preventDefault(); viewRef.current.zoom = clamp(viewRef.current.zoom - event.deltaY * .001, .72, 1.55); }} onDoubleClick={resetView}/><div className={styles.label}><i className={status === "ready" ? styles.live : ""} style={status === "ready" && props.accent ? { background: props.accent, boxShadow: `0 0 12px ${props.accent}` } : undefined}/><span>MACHINING KIT V1</span><b>{status === "loading" ? "DECODING" : status === "ready" ? "LIVE GLB" : "SAFE FALLBACK"}</b></div>
    <div className={styles.signal}><span>{props.material ?? "XYZ BIND"}</span><b>{props.spindle ? "CUTTING" : "SAFE Z"}</b><em>{props.load}% LOAD</em></div>
    {props.verbose !== false && <div className={styles.renderSpec}><span>HIERARCHY</span><i/> <span>LIVE CUT FX</span><i/> <span>METAL PBR</span></div>}
    {props.variant === "full" && <div className={styles.orbitControls}><span>DRAG TO ORBIT · WHEEL TO ZOOM</span><button aria-pressed={autoOrbit} onClick={() => setAutoOrbit((value) => !value)}>{autoOrbit ? "PAUSE ORBIT" : "AUTO ORBIT"}</button><button onClick={resetView}>RESET VIEW</button></div>}
  </aside>;
}
