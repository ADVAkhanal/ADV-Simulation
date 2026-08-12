"use client";

import { useEffect, useRef, useState } from "react";
import { trackAnonymous } from "./anonymous-analytics";
import { MILL_COLS, MILL_ROWS, isManualTarget, type ManualContract } from "./manual-campaign-engine";
import ThreeMachiningStage from "./three-machining-stage";
import styles from "./flagship-machining-kit.module.css";

type Vec3 = [number, number, number];
type Mat4 = [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
type Face = { vertices: [Vec3, Vec3, Vec3]; color: string; node: string; metallic: number; roughness: number };
type Scene = { faces: Face[]; bytes: number };
type Props = { cursor: { x: number; y: number }; spindle: boolean; completion: number; load: number; variant?: "mini" | "full"; material?: string; accent?: string; verbose?: boolean; cells?: Uint8Array; contractId?: ManualContract["id"]; toolpath?: Array<{ x: number; y: number }>; interactive?: boolean; toolId?: number };
type ViewState = { yaw: number; pitch: number; zoom: number; autoOrbit: boolean };

// Node names for every cutting tool the Blender kit ships (see
// tools/blender/build-machining-kit.py, manifest.tools). All three exist in
// the GLB simultaneously under the same spindle anchor; only the one
// matching the game's active tool selection is kept visible per frame.
const TOOL_NODE_BY_ID: Record<number, string> = { 1: "tool.endmill.flat.010", 2: "tool.endmill.rougher.020", 3: "tool.drill.030" };
const TOOL_LABEL_BY_ID: Record<number, string> = { 1: "T1 FINISHER", 2: "T2 ROUGHER", 3: "T3 DRILL" };
function activeToolNode(toolId?: number) { return TOOL_NODE_BY_ID[toolId ?? 1] ?? TOOL_NODE_BY_ID[1]; }

const colors = ["#24353a", "#4ae2fa", "#778b90", "#c6d4d6", "#6a7c81", "#18252a"];
const STOCK_MATERIAL_COLORS: Record<string, string> = { "6061 AL": "rgb(174,190,194)", "7075-T6": "rgb(182,196,168)", "Ti-6Al-4V": "rgb(146,156,168)" };
function stockMaterialColor(material?: string) { return (material && STOCK_MATERIAL_COLORS[material]) || STOCK_MATERIAL_COLORS["6061 AL"]; }
// Aluminum swarf stays bright and silvery. Titanium runs hot and poorly
// conducts heat away from the edge, so its chips discolor blue/violet -
// the classic "blue chip" tell of a titanium cut.
const CHIP_MATERIAL_COLORS: Record<string, { cool: string; hot: string; hotRate: number }> = {
  "6061 AL": { cool: "205,230,232", hot: "255,178,80", hotRate: .25 },
  "7075-T6": { cool: "222,224,196", hot: "255,196,90", hotRate: .3 },
  "Ti-6Al-4V": { cool: "150,178,232", hot: "120,90,220", hotRate: .55 },
};
function chipMaterialColors(material?: string) { return (material && CHIP_MATERIAL_COLORS[material]) || CHIP_MATERIAL_COLORS["6061 AL"]; }

function clamp(value: number, min = 0, max = 1) { return Math.max(min, Math.min(max, value)); }
function shade(color: string, light: number, metallic: number) {
  const values = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [92, 112, 118];
  const specular = Math.pow(clamp(light), 6) * metallic * 92;
  return `rgb(${values.map((value) => Math.round(clamp(value * (.42 + light * .9) + specular, 0, 255))).join(",")})`;
}
// The GLB is exported Y-up (export_yup=True), so Blender's vertical Z axis
// lands in glTF's Y component. Width stays on X; depth (Blender Y, machine
// front/back) lands on glTF Z. Do not swap these back without re-checking
// the exporter flag.
function stockBounds(faces: Face[]): { minX: number; maxX: number; minDepth: number; maxDepth: number; topY: number } | null {
  const points = faces.filter((face) => face.node === "stock.block.flagship").flatMap((face) => face.vertices);
  if (!points.length) return null;
  return {
    minX: Math.min(...points.map((point) => point[0])), maxX: Math.max(...points.map((point) => point[0])),
    minDepth: Math.min(...points.map((point) => point[2])), maxDepth: Math.max(...points.map((point) => point[2])),
    topY: Math.max(...points.map((point) => point[1])),
  };
}
type StockBounds = NonNullable<ReturnType<typeof stockBounds>>;
function pocketFaces(bounds: StockBounds, cells: Uint8Array, contractId: ManualContract["id"]): Face[] {
  const { minX, maxX, minDepth, maxDepth, topY } = bounds, spanX = maxX - minX, spanDepth = maxDepth - minDepth, recess = topY - Math.max(3, spanX * .02);
  const faces: Face[] = [];
  for (let row = 0; row < MILL_ROWS; row += 1) for (let col = 0; col < MILL_COLS; col += 1) {
    const index = row * MILL_COLS + col;
    if (cells[index] !== 0) continue;
    const x0 = minX + (col / MILL_COLS) * spanX, x1 = minX + ((col + 1) / MILL_COLS) * spanX;
    const z0 = minDepth + (row / MILL_ROWS) * spanDepth, z1 = minDepth + ((row + 1) / MILL_ROWS) * spanDepth;
    const color = isManualTarget(contractId, col, row) ? "rgb(255,86,110)" : "rgb(132,158,163)";
    const a: Vec3 = [x0, recess, z0], b: Vec3 = [x1, recess, z0], c: Vec3 = [x1, recess, z1], d: Vec3 = [x0, recess, z1];
    faces.push({ node: "stock.pocket", color, metallic: .25, roughness: .55, vertices: [a, b, c] });
    faces.push({ node: "stock.pocket", color, metallic: .25, roughness: .55, vertices: [a, c, d] });
  }
  return faces;
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
    if (node.startsWith("machine.spindle") || node.startsWith("machine.coolant") || node.startsWith("tool.")) { x += toolX; z += toolZ; y += props.spindle ? -22 : 0; }
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
  const activeTool = activeToolNode(props.toolId);
  const cutter = project(averagePoint(activeTool), activeTool);
  const coolant = project(averagePoint("machine.coolant.manifold"), "machine.coolant.manifold");
  context.save(); context.filter = "blur(10px)"; context.globalAlpha = .62; context.fillStyle = "#000"; context.beginPath(); context.ellipse(bounds.width * .49, bounds.height * .77, bounds.width * .34, bounds.height * .075, -.02, 0, Math.PI * 2); context.fill(); context.restore();
  if (props.spindle) {
    const workGlow = context.createRadialGradient(cutter.x, cutter.y, 0, cutter.x, cutter.y, Math.max(54, bounds.width * .09));
    workGlow.addColorStop(0, `rgba(255,175,78,${.3 + props.load / 330})`); workGlow.addColorStop(.25, "rgba(80,230,255,.16)"); workGlow.addColorStop(1, "rgba(0,0,0,0)");
    context.save(); context.globalCompositeOperation = "screen"; context.fillStyle = workGlow; context.fillRect(0, 0, bounds.width, bounds.height); context.restore();
  }
  const bounds3d = stockBounds(scene.faces);
  const pockets = props.cells && props.contractId && bounds3d ? pocketFaces(bounds3d, props.cells, props.contractId) : [];
  // The GLB carries every tool the game can mount under the same spindle
  // anchor; only render the one the player actually has selected so
  // switching tools visibly changes what's in the spindle.
  const visibleFaces = scene.faces.filter((face) => !face.node.startsWith("tool.") || face.node === activeTool);
  const projected = [...visibleFaces, ...pockets].map((face) => ({ face, points: face.vertices.map((point) => project(point, face.node)), depth: face.vertices.reduce((sum, point) => sum + project(point, face.node).depth, 0) / 3 })).sort((a, b) => a.depth - b.depth);
  projected.forEach(({ face, points }) => {
    context.beginPath(); context.moveTo(points[0].x, points[0].y); context.lineTo(points[1].x, points[1].y); context.lineTo(points[2].x, points[2].y); context.closePath();
    const illumination = faceLight(face.vertices), depthFade = clamp(.78 + points[0].depth * .16, .58, 1);
    const isStock = face.node.includes("stock"), isPocket = face.node === "stock.pocket", isTool = face.node.startsWith("tool."), isSpindle = face.node.includes("spindle"), isFixture = face.node.includes("vise") || face.node.includes("fixture") || face.node.includes("jaw"), isWorklight = face.node.includes("worklight"), isEnclosure = face.node.includes("enclosure");
    const materialColor = isPocket ? face.color : isStock ? stockMaterialColor(props.material) : isFixture ? "rgb(79,101,108)" : isSpindle ? "rgb(65,84,91)" : isEnclosure ? "rgb(37,49,54)" : face.color;
    context.globalAlpha = .98 * depthFade;
    context.fillStyle = isTool && props.spindle ? "#7ff1ff" : isWorklight ? "#ff9b3f" : shade(materialColor, illumination, face.metallic); context.fill();
    context.strokeStyle = isTool ? "#e8fdff" : isPocket ? "rgba(8,14,16,.4)" : isStock ? "rgba(235,250,252,.28)" : `rgba(208,232,236,${.08 + (1 - face.roughness) * .11})`; context.lineWidth = isTool ? 1.15 : isPocket ? .35 : isStock ? .65 : .45; context.stroke();
  });
  context.globalAlpha = 1;
  if (bounds3d && props.toolpath && props.toolpath.length > 1) {
    const { minX, maxX, minDepth, maxDepth, topY } = bounds3d, spanX = maxX - minX, spanDepth = maxDepth - minDepth;
    const trailPoints = props.toolpath.map((point) => project([minX + (point.x / (MILL_COLS - 1)) * spanX, topY + 2, minDepth + (point.y / (MILL_ROWS - 1)) * spanDepth], "toolpath.trail"));
    context.save(); context.lineJoin = "round"; context.lineCap = "round";
    for (let index = 1; index < trailPoints.length; index += 1) {
      const age = index / trailPoints.length, from = trailPoints[index - 1], to = trailPoints[index];
      context.strokeStyle = `${props.accent ?? "#7ff1ff"}${Math.round(age * 200 + 40).toString(16).padStart(2, "0")}`;
      context.lineWidth = 1.4; context.beginPath(); context.moveTo(from.x, from.y); context.lineTo(to.x, to.y); context.stroke();
    }
    context.restore();
  }
  if (props.spindle) {
    const pulse = .48 + Math.sin(time / 65) * .14, phase = reducedMotion ? 0 : time * .032;
    context.save(); context.globalCompositeOperation = "screen";
    context.strokeStyle = `rgba(128,241,255,${pulse})`; context.lineWidth = 1.2; context.beginPath(); context.ellipse(cutter.x, cutter.y, 15 + props.load * .05, 5 + props.load * .018, 0, 0, Math.PI * 2); context.stroke();
    for (let blade = 0; blade < 3; blade += 1) { const angle = phase + blade * Math.PI * 2 / 3; context.strokeStyle = "rgba(226,253,255,.72)"; context.beginPath(); context.moveTo(cutter.x, cutter.y); context.lineTo(cutter.x + Math.cos(angle) * 14, cutter.y + Math.sin(angle) * 5); context.stroke(); }
    for (const side of [-1, 1]) { context.strokeStyle = "rgba(93,225,244,.34)"; context.lineWidth = 1.1; context.beginPath(); context.moveTo(coolant.x + side * 8, coolant.y); context.quadraticCurveTo((coolant.x + cutter.x) / 2 + side * 15, cutter.y - 12, cutter.x + side * 5, cutter.y); context.stroke(); }
    const chips = props.variant === "full" ? 20 : 9, chipColors = chipMaterialColors(props.material);
    for (let index = 0; index < chips; index += 1) { const age = ((time / 720 + index * .173) % 1), angle = -2.7 + (index % 7) * .23; const reach = (18 + (index % 5) * 7) * age; const x = cutter.x + Math.cos(angle) * reach, y = cutter.y + Math.sin(angle) * reach + age * age * 26; const isHot = (index * 7919) % 100 / 100 < chipColors.hotRate; context.fillStyle = isHot ? `rgba(${chipColors.hot},${.8 - age * .7})` : `rgba(${chipColors.cool},${1 - age})`; context.fillRect(x, y, 1.5 + (index % 2), .8); }
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
  const [resetToken, setResetToken] = useState(0);
  useEffect(() => { propsRef.current = props; }, [props]);
  useEffect(() => { viewRef.current.autoOrbit = autoOrbit; }, [autoOrbit]);
  useEffect(() => { reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches; }, []);
  useEffect(() => {
    const controller = new AbortController();
    const forced = new URLSearchParams(location.search).has("assetFallback");
    if (forced) { sceneRef.current = null; return () => controller.abort(); }
    fetch("/assets/workholding/toolpath-machining-kit-v1.glb", { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.arrayBuffer();
    }).then(parseGlb).then((scene) => { sceneRef.current = scene; }).catch((reason: Error) => {
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
  const resetView = () => { viewRef.current = { yaw: -.72, pitch: -.42, zoom: 1, autoOrbit: true }; setResetToken((value) => value + 1); setAutoOrbit(true); trackAnonymous("twin_view_reset", { surface: props.variant ?? "mini" }); };
  const draggable = props.variant === "full" || props.interactive === true;
  return <aside className={`${styles.kit} ${props.variant === "full" ? styles.full : ""} ${draggable ? styles.interactive : ""}`} aria-label="Live 3D machining kit visualization">
    {status !== "fallback" && <ThreeMachiningStage {...props} autoOrbit={autoOrbit} resetToken={resetToken} interactive={draggable} onReady={() => { setStatus("ready"); trackAnonymous("asset_ready", { asset: "machining-kit-v1", renderer: "three" }); }} onFailure={() => { setStatus("fallback"); trackAnonymous("asset_fallback", { asset: "machining-kit-v1", reason: "webgl" }); }}/>} 
    {status === "fallback" && <canvas ref={canvasRef} tabIndex={draggable ? 0 : -1} aria-label="Safe canvas fallback for the interactive machining assembly" onPointerDown={(event) => { if (!draggable) return; dragRef.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); setAutoOrbit(false); }} onPointerMove={(event) => { const start = dragRef.current; if (!start || !draggable) return; viewRef.current.yaw += (event.clientX - start.x) * .008; viewRef.current.pitch = clamp(viewRef.current.pitch + (event.clientY - start.y) * .006, -.95, .2); dragRef.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }} onWheel={(event) => { if (!draggable) return; event.preventDefault(); viewRef.current.zoom = clamp(viewRef.current.zoom - event.deltaY * .001, .72, 1.55); }} onDoubleClick={resetView}/>}<div className={styles.label}><i className={status === "ready" ? styles.live : ""} style={status === "ready" && props.accent ? { background: props.accent, boxShadow: `0 0 12px ${props.accent}` } : undefined}/><span>MACHINING KIT V2</span><b>{status === "loading" ? "INITIALIZING THREE.JS" : status === "ready" ? "LIVE WEBGL" : "SAFE FALLBACK"}</b></div>
    <div className={styles.signal}><span>{props.material ?? "XYZ BIND"}</span><b>{props.spindle ? "CUTTING" : "SAFE Z"}</b><em>{props.load}% LOAD</em></div>
    <div className={styles.signal}><span>{TOOL_LABEL_BY_ID[props.toolId ?? 1] ?? TOOL_LABEL_BY_ID[1]}</span><b>MOUNTED</b></div>
    {props.verbose !== false && draggable && <div className={styles.renderSpec}><span>GLB HIERARCHY</span><i/> <span>LIVE CUT FX</span><i/> <span>METAL PBR</span></div>}
    {draggable && <div className={styles.orbitControls}><span>DRAG TO ORBIT · WHEEL TO ZOOM</span><button aria-pressed={autoOrbit} onClick={() => setAutoOrbit((value) => !value)}>{autoOrbit ? "PAUSE ORBIT" : "AUTO ORBIT"}</button><button onClick={resetView}>RESET VIEW</button></div>}
  </aside>;
}
