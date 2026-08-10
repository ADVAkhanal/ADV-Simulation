"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./tool-crib-viewer.module.css";

type Vec3 = [number, number, number];
type Mat4 = [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
type Face = { vertices: [Vec3, Vec3, Vec3]; color: string; node: string; metallic: number; roughness: number };
type Scene = { faces: Face[] };
type Props = { activeTool: number };

function clamp(value: number, min = 0, max = 1) { return Math.max(min, Math.min(max, value)); }
function shade(color: string, light: number, metallic: number) {
  const values = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [92, 112, 118];
  const specular = Math.pow(clamp(light), 6) * metallic * 82;
  return `rgb(${values.map((value) => Math.round(clamp(value * (.4 + light * .95) + specular, 0, 255))).join(",")})`;
}
function faceLight(vertices: [Vec3, Vec3, Vec3]) {
  const [a, b, c] = vertices, ab = b.map((value, axis) => value - a[axis]) as Vec3, ac = c.map((value, axis) => value - a[axis]) as Vec3;
  const normal: Vec3 = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  const magnitude = Math.hypot(...normal) || 1, light: Vec3 = [-.3, .8, .5];
  return clamp(.3 + Math.abs((normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2]) / magnitude) * .7);
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
      const color = base ? `rgb(${base.slice(0, 3).map((value: number) => Math.round(value * 255)).join(",")})` : "rgb(120,132,138)";
      for (let index = 0; index + 2 < indices.length; index += 3) {
        const triangle = [indices[index][0], indices[index + 1][0], indices[index + 2][0]];
        faces.push({ node: node.name, color, metallic: pbr?.metallicFactor ?? .5, roughness: pbr?.roughnessFactor ?? .4, vertices: triangle.map((vertex) => transform(positions[vertex], world)) as [Vec3, Vec3, Vec3] });
      }
    }
    for (const child of node.children ?? []) walk(child, world);
  };
  const roots = json.scenes?.[json.scene ?? 0]?.nodes ?? json.nodes.map((_: unknown, index: number) => index);
  roots.forEach((node: number) => walk(node, identity));
  if (!faces.length) throw new Error("GLB contains no drawable faces");
  return { faces };
}

export default function ToolCribViewer({ activeTool }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null), sceneRef = useRef<Scene | null>(null);
  const activeToolRef = useRef(activeTool);
  const yawRef = useRef(-.55);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  activeToolRef.current = activeTool;

  useEffect(() => {
    const controller = new AbortController();
    fetch("/assets/workholding/toolpath-tool-crib-v1.glb", { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.arrayBuffer();
    }).then(parseGlb).then((scene) => { sceneRef.current = scene; setStatus("ready"); }).catch((reason: Error) => {
      if (reason.name === "AbortError") return;
      console.error("toolpath.tool_crib_load_error", reason.message);
      setStatus("fallback");
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let frame = 0;
    const render = (time: number) => {
      const canvas = canvasRef.current, scene = sceneRef.current;
      if (canvas && scene) draw(canvas, scene, activeToolRef.current, yawRef.current + time / 42000, time);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <div className={styles.viewer} aria-label="Tool crib 3D reference">
    <canvas ref={canvasRef}/>
    <div className={styles.label}><i className={status === "ready" ? styles.live : ""}/><span>TOOL CRIB</span><b>{status === "loading" ? "DECODING" : status === "ready" ? "LIVE GLB" : "SAFE FALLBACK"}</b></div>
    <div className={styles.signal}><span>CHECKED IN</span><b>T{activeTool}</b></div>
  </div>;
}

function draw(canvas: HTMLCanvasElement, scene: Scene, activeTool: number, yaw: number, time: number) {
  const bounds = canvas.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(bounds.width * ratio)); canvas.height = Math.max(1, Math.round(bounds.height * ratio));
  const context = canvas.getContext("2d"); if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, bounds.width, bounds.height);
  const bg = context.createLinearGradient(0, 0, bounds.width, bounds.height); bg.addColorStop(0, "#101b20"); bg.addColorStop(1, "#04080a");
  context.fillStyle = bg; context.fillRect(0, 0, bounds.width, bounds.height);

  const all = scene.faces.flatMap((face) => face.vertices);
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  all.forEach((point) => point.forEach((value, axis) => { min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value); }));
  const center = min.map((value, axis) => (value + max[axis]) / 2) as Vec3, extent = Math.max(...max.map((value, axis) => value - min[axis])) || 1;
  const pitch = -.28;
  const project = (point: Vec3) => {
    const nx = (point[0] - center[0]) / extent, ny = (point[1] - center[1]) / extent, nz = (point[2] - center[2]) / extent;
    const rx = nx * Math.cos(yaw) + nz * Math.sin(yaw), rz = -nx * Math.sin(yaw) + nz * Math.cos(yaw);
    const ry = ny * Math.cos(pitch) - rz * Math.sin(pitch), depth = ny * Math.sin(pitch) + rz * Math.cos(pitch);
    const perspective = 1 / (1.7 - depth * .4), scale = Math.min(bounds.width, bounds.height) * .92;
    return { x: bounds.width / 2 + rx * scale * perspective, y: bounds.height * .56 - ry * scale * perspective, depth };
  };

  const activeNodes = [`toolcrib.slot.${String(activeTool).padStart(2, "0")}`, `tool.endmill.crib.${String(activeTool).padStart(2, "0")}`];
  const activePoints = scene.faces.filter((face) => activeNodes.includes(face.node)).flatMap((face) => face.vertices).map(project);
  if (activePoints.length) {
    const cx = activePoints.reduce((sum, point) => sum + point.x, 0) / activePoints.length;
    const cy = activePoints.reduce((sum, point) => sum + point.y, 0) / activePoints.length;
    const pulse = .55 + Math.sin(time / 260) * .2;
    const glow = context.createRadialGradient(cx, cy, 0, cx, cy, 70);
    glow.addColorStop(0, `rgba(0,174,239,${pulse})`); glow.addColorStop(1, "rgba(0,174,239,0)");
    context.save(); context.globalCompositeOperation = "screen"; context.fillStyle = glow; context.fillRect(0, 0, bounds.width, bounds.height); context.restore();
  }

  const projected = scene.faces.map((face) => {
    const points = face.vertices.map(project);
    const isActive = activeNodes.includes(face.node);
    return { face, points, isActive, depth: (points[0].depth + points[1].depth + points[2].depth) / 3 };
  }).sort((a, b) => a.depth - b.depth);

  projected.forEach(({ face, points, isActive }) => {
    context.beginPath(); context.moveTo(points[0].x, points[0].y); context.lineTo(points[1].x, points[1].y); context.lineTo(points[2].x, points[2].y); context.closePath();
    const illumination = faceLight(face.vertices), depthFade = clamp(.8 + points[0].depth * .16, .6, 1);
    context.globalAlpha = depthFade;
    context.fillStyle = isActive ? shade("rgb(0,174,239)", illumination, .5) : shade(face.color, illumination, face.metallic);
    context.fill();
    context.strokeStyle = isActive ? "#7ff1ff" : "rgba(190,210,214,.14)"; context.lineWidth = isActive ? 1 : .4; context.stroke();
  });
  context.globalAlpha = 1;
}
