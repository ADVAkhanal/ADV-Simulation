"use client";

import { useEffect, useRef, useState } from "react";
import { trackAnonymous } from "./anonymous-analytics";
import styles from "./flagship-machining-kit.module.css";

type Vec3 = [number, number, number];
type Face = { vertices: [Vec3, Vec3, Vec3]; color: string; node: string; metallic: number; roughness: number };
type Scene = { faces: Face[]; bytes: number };
type Props = { cursor: { x: number; y: number }; spindle: boolean; completion: number; load: number; variant?: "mini" | "full" };

const colors = ["#24353a", "#4ae2fa", "#778b90", "#c6d4d6", "#6a7c81", "#18252a"];

function clamp(value: number, min = 0, max = 1) { return Math.max(min, Math.min(max, value)); }
function shade(color: string, light: number, metallic: number) {
  const values = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [92, 112, 118];
  const specular = Math.pow(clamp(light), 7) * metallic * 74;
  return `rgb(${values.map((value) => Math.round(clamp(value * (.24 + light * .82) + specular, 0, 255))).join(",")})`;
}
function faceLight(vertices: [Vec3, Vec3, Vec3]) {
  const [a, b, c] = vertices, ab = b.map((value, axis) => value - a[axis]) as Vec3, ac = c.map((value, axis) => value - a[axis]) as Vec3;
  const normal: Vec3 = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  const magnitude = Math.hypot(...normal) || 1, light: Vec3 = [-.35, .82, .45];
  return clamp(.16 + Math.abs((normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2]) / magnitude) * .84);
}

function components(type: string) { return type === "VEC2" ? 2 : type === "VEC3" ? 3 : type === "VEC4" ? 4 : 1; }
function reader(componentType: number) {
  if (componentType === 5121) return { bytes: 1, get: (view: DataView, offset: number) => view.getUint8(offset) };
  if (componentType === 5123) return { bytes: 2, get: (view: DataView, offset: number) => view.getUint16(offset, true) };
  if (componentType === 5125) return { bytes: 4, get: (view: DataView, offset: number) => view.getUint32(offset, true) };
  if (componentType === 5126) return { bytes: 4, get: (view: DataView, offset: number) => view.getFloat32(offset, true) };
  throw new Error(`Unsupported GLB component ${componentType}`);
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
  const walk = (nodeIndex: number, parent: Vec3) => {
    const node = json.nodes[nodeIndex], local = node.translation ?? [0, 0, 0];
    const origin: Vec3 = [parent[0] + local[0], parent[1] + local[1], parent[2] + local[2]];
    if (node.mesh !== undefined) for (const primitive of json.meshes[node.mesh].primitives) {
      const positions = readAccessor(primitive.attributes.POSITION) as Vec3[];
      const indices = primitive.indices === undefined ? positions.map((_, index) => [index]) : readAccessor(primitive.indices);
      const material = json.materials?.[primitive.material ?? 0];
      const pbr = material?.pbrMetallicRoughness, base = pbr?.baseColorFactor;
      const color = base ? `rgb(${base.slice(0, 3).map((value: number) => Math.round(value * 255)).join(",")})` : colors[(primitive.material ?? 0) % colors.length];
      for (let index = 0; index + 2 < indices.length; index += 3) {
        const triangle = [indices[index][0], indices[index + 1][0], indices[index + 2][0]];
        faces.push({ node: node.name, color, metallic: pbr?.metallicFactor ?? .72, roughness: pbr?.roughnessFactor ?? .34, vertices: triangle.map((vertex) => positions[vertex].map((value, axis) => value + origin[axis]) as Vec3) as [Vec3, Vec3, Vec3] });
      }
    }
    for (const child of node.children ?? []) walk(child, origin);
  };
  const roots = json.scenes?.[json.scene ?? 0]?.nodes ?? json.nodes.map((_: unknown, index: number) => index);
  roots.forEach((node: number) => walk(node, [0, 0, 0]));
  if (!faces.length) throw new Error("GLB contains no drawable faces");
  return { faces, bytes: buffer.byteLength };
}

function draw(canvas: HTMLCanvasElement, scene: Scene | null, props: Props, fallback: boolean) {
  const bounds = canvas.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(bounds.width * ratio)); canvas.height = Math.max(1, Math.round(bounds.height * ratio));
  const context = canvas.getContext("2d"); if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, bounds.width, bounds.height);
  const bg = context.createLinearGradient(0, 0, bounds.width, bounds.height); bg.addColorStop(0, "#122126"); bg.addColorStop(1, "#05090b");
  context.fillStyle = bg; context.fillRect(0, 0, bounds.width, bounds.height);
  const inspectionLight = context.createRadialGradient(bounds.width * .24, bounds.height * .12, 0, bounds.width * .24, bounds.height * .12, bounds.width * .78);
  inspectionLight.addColorStop(0, "#d8f7ff1c"); inspectionLight.addColorStop(.5, "#50d8ee08"); inspectionLight.addColorStop(1, "#00000000"); context.fillStyle = inspectionLight; context.fillRect(0, 0, bounds.width, bounds.height);
  const horizon = bounds.height * .71, vanishingX = bounds.width * .46;
  context.strokeStyle = "#8bb2ba16"; context.lineWidth = 1;
  for (let lane = -7; lane <= 7; lane += 1) { context.beginPath(); context.moveTo(vanishingX, horizon); context.lineTo(vanishingX + lane * bounds.width * .12, bounds.height); context.stroke(); }
  for (let step = 1; step <= 8; step += 1) { const y = horizon + Math.pow(step / 8, 1.7) * (bounds.height - horizon); context.beginPath(); context.moveTo(0, y); context.lineTo(bounds.width, y); context.stroke(); }
  if (!scene || fallback) {
    context.fillStyle = "#1d3036"; context.fillRect(bounds.width * .08, bounds.height * .72, bounds.width * .84, bounds.height * .12);
    context.fillStyle = "#35494f"; context.fillRect(bounds.width * .24, bounds.height * .57, bounds.width * .52, bounds.height * .16);
    context.fillStyle = "#a8babd"; context.fillRect(bounds.width * .34, bounds.height * .49, bounds.width * .32, bounds.height * .1);
    const x = bounds.width * (.34 + props.cursor.x / 27 * .32), y = bounds.height * (.18 + props.cursor.y / 15 * .24);
    context.strokeStyle = props.spindle ? "#50e6ff" : "#759096"; context.lineWidth = 8; context.beginPath(); context.moveTo(x, 0); context.lineTo(x, y); context.stroke();
    return;
  }
  const all = scene.faces.flatMap((face) => face.vertices);
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  all.forEach((point) => point.forEach((value, axis) => { min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value); }));
  const center = min.map((value, axis) => (value + max[axis]) / 2) as Vec3, extent = Math.max(...max.map((value, axis) => value - min[axis])) || 1;
  const toolX = (props.cursor.x / 27 - .5) * 230, toolZ = (props.cursor.y / 15 - .5) * 120;
  const orbit = props.spindle ? 0 : Math.sin(performance.now() / 6200) * .025;
  const project = (point: Vec3, node: string) => {
    let [x, y, z] = point;
    if (node.startsWith("machine.spindle") || node.startsWith("tool.endmill")) { x += toolX; z += toolZ; y += props.spindle ? -22 : 0; }
    const nx = (x - center[0]) / extent, ny = (y - center[1]) / extent, nz = (z - center[2]) / extent;
    const yaw = -.72 + orbit, pitch = -.42, rx = nx * Math.cos(yaw) + nz * Math.sin(yaw), rz = -nx * Math.sin(yaw) + nz * Math.cos(yaw);
    const ry = ny * Math.cos(pitch) - rz * Math.sin(pitch), depth = ny * Math.sin(pitch) + rz * Math.cos(pitch);
    const perspective = 1 / (1.7 - depth * .42), scale = Math.min(bounds.width, bounds.height) * .88;
    return { x: bounds.width / 2 + rx * scale * perspective, y: bounds.height * .54 - ry * scale * perspective, depth };
  };
  context.save(); context.filter = "blur(10px)"; context.globalAlpha = .62; context.fillStyle = "#000"; context.beginPath(); context.ellipse(bounds.width * .49, bounds.height * .77, bounds.width * .34, bounds.height * .075, -.02, 0, Math.PI * 2); context.fill(); context.restore();
  const projected = scene.faces.map((face) => ({ face, points: face.vertices.map((point) => project(point, face.node)), depth: face.vertices.reduce((sum, point) => sum + project(point, face.node).depth, 0) / 3 })).sort((a, b) => a.depth - b.depth);
  projected.forEach(({ face, points }) => {
    context.beginPath(); context.moveTo(points[0].x, points[0].y); context.lineTo(points[1].x, points[1].y); context.lineTo(points[2].x, points[2].y); context.closePath();
    const illumination = faceLight(face.vertices), depthFade = clamp(.78 + points[0].depth * .16, .58, 1);
    context.globalAlpha = (face.node === "stock.block.flagship" ? Math.max(.3, 1 - props.completion / 135) : .94) * depthFade;
    context.fillStyle = face.node.startsWith("tool.endmill") && props.spindle ? "#55e8ff" : shade(face.color, illumination, face.metallic); context.fill();
    context.strokeStyle = face.node.startsWith("tool.endmill") ? "#d7fbff" : `rgba(208,232,236,${.035 + (1 - face.roughness) * .075})`; context.lineWidth = face.node.startsWith("tool.endmill") ? .9 : .35; context.stroke();
  });
  context.globalAlpha = 1;
  if (props.spindle) {
    const pulse = .45 + Math.sin(performance.now() / 65) * .12;
    context.strokeStyle = `rgba(80,230,255,${pulse})`; context.lineWidth = 1; context.beginPath(); context.ellipse(bounds.width * .5, bounds.height * .35, bounds.width * .055, bounds.height * .018, 0, 0, Math.PI * 2); context.stroke();
  }
  const vignette = context.createRadialGradient(bounds.width / 2, bounds.height / 2, Math.min(bounds.width, bounds.height) * .25, bounds.width / 2, bounds.height / 2, Math.max(bounds.width, bounds.height) * .7);
  vignette.addColorStop(0, "#00000000"); vignette.addColorStop(1, "#00000080"); context.fillStyle = vignette; context.fillRect(0, 0, bounds.width, bounds.height);
}

export default function FlagshipMachiningKit(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null), sceneRef = useRef<Scene | null>(null), propsRef = useRef(props);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  propsRef.current = props;
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
    const render = () => { const canvas = canvasRef.current; if (canvas) draw(canvas, sceneRef.current, propsRef.current, status === "fallback"); frame = requestAnimationFrame(render); };
    frame = requestAnimationFrame(render); return () => cancelAnimationFrame(frame);
  }, [status]);
  return <aside className={`${styles.kit} ${props.variant === "full" ? styles.full : ""}`} aria-label="Live 3D machining kit visualization">
    <canvas ref={canvasRef}/><div className={styles.label}><i className={status === "ready" ? styles.live : ""}/><span>MACHINING KIT V1</span><b>{status === "loading" ? "DECODING" : status === "ready" ? "LIVE GLB" : "SAFE FALLBACK"}</b></div>
    <div className={styles.signal}><span>XYZ BIND</span><b>{props.spindle ? "CUTTING" : "SAFE Z"}</b><em>{props.load}% LOAD</em></div><div className={styles.renderSpec}><span>PHYSICAL LIGHT</span><i/> <span>DEPTH SORT</span><i/> <span>METAL PBR</span></div>
  </aside>;
}
