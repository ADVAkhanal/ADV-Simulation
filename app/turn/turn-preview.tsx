"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import styles from "./turn.module.css";

export type TurnPoint = { x: number; z: number; cutting: boolean; line: number };
type Props = { points: TurnPoint[]; frame: number; spindle: boolean; coolant: boolean; accent: string };
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

export default function TurnPreview(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null), current = useRef(props);
  useEffect(() => { current.current = props; }, [props]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); } catch { return; }
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05090b); scene.fog = new THREE.FogExp2(0x061216, .035);
    const camera = new THREE.PerspectiveCamera(36, 1, .1, 120); camera.position.set(22, 14, 31); camera.lookAt(0, 0, -13);
    scene.add(new THREE.HemisphereLight(0xd9f8ff, 0x071013, 2.5)); const key = new THREE.DirectionalLight(0xffffff, 4.8); key.position.set(16, 22, 20); scene.add(key); const rim = new THREE.PointLight(0x3aeaff, 20, 60, 2); rim.position.set(-16, 6, -24); scene.add(rim);
    const floor = new THREE.GridHelper(70, 28, 0x185563, 0x0b2b31); floor.position.y = -8; scene.add(floor);
    const machine = new THREE.Group(); scene.add(machine); const steel = new THREE.MeshStandardMaterial({ color: 0x203840, metalness: .86, roughness: .28 }), dark = new THREE.MeshStandardMaterial({ color: 0x0b161a, metalness: .75, roughness: .38 });
    const bed = new THREE.Mesh(new THREE.BoxGeometry(44, 3, 12), dark); bed.position.set(0, -6, -14); machine.add(bed);
    const chuck = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 6, 32), steel); chuck.rotation.x = Math.PI / 2; chuck.position.set(0, 0, 7); machine.add(chuck);
    const jaws = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 2.4, 5), new THREE.MeshStandardMaterial({ color: 0x6f858b, metalness: .92, roughness: .22 }), 3); const matrix = new THREE.Matrix4(); for (let index = 0; index < 3; index += 1) { const angle = index / 3 * Math.PI * 2; matrix.compose(new THREE.Vector3(Math.cos(angle) * 5, Math.sin(angle) * 5, 6.2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle), new THREE.Vector3(1, 1, 1)); jaws.setMatrixAt(index, matrix); } machine.add(jaws);
    const stockGroup = new THREE.Group(); machine.add(stockGroup); const segments = 72, segmentLength = .48, segmentGeometry = new THREE.CylinderGeometry(1, 1, segmentLength * .94, 28), stockMaterial = new THREE.MeshStandardMaterial({ color: 0xaac6cb, metalness: .9, roughness: .24 }), stock = new THREE.InstancedMesh(segmentGeometry, stockMaterial, segments); stock.instanceMatrix.setUsage(THREE.DynamicDrawUsage); stockGroup.add(stock);
    const tool = new THREE.Group(); const holder = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 4), dark); holder.position.x = 9; tool.add(holder); const insert = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3, 4), new THREE.MeshStandardMaterial({ color: 0xffb356, emissive: 0x351805, metalness: .55, roughness: .3 })); insert.rotation.z = -Math.PI / 2; insert.position.set(5.2, 0, 0); tool.add(insert); machine.add(tool); const contact = new THREE.PointLight(0x67efff, 0, 14, 2); machine.add(contact);
    const drag = { active: false, x: 0, y: 0, yaw: .55, pitch: .3 }; const down = (event: PointerEvent) => { drag.active = true; drag.x = event.clientX; drag.y = event.clientY; canvas.setPointerCapture(event.pointerId); }; const move = (event: PointerEvent) => { if (!drag.active) return; drag.yaw += (event.clientX - drag.x) * .008; drag.pitch = clamp(drag.pitch + (event.clientY - drag.y) * .006, -.15, .85); drag.x = event.clientX; drag.y = event.clientY; }; const up = () => { drag.active = false; };
    canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    const resize = () => { const rect = canvas.getBoundingClientRect(); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false); camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height); camera.updateProjectionMatrix(); }; const observer = new ResizeObserver(resize); observer.observe(canvas); resize(); let animation = 0;
    const draw = (time: number) => { const live = current.current, visible = live.points.slice(0, Math.max(1, live.frame)), radii = new Float32Array(segments).fill(5.4); for (let index = 1; index < visible.length; index += 1) { const from = visible[index - 1], to = visible[index]; if (!to.cutting) continue; const a = clamp(Math.round((-from.z / 36) * (segments - 1)), 0, segments - 1), b = clamp(Math.round((-to.z / 36) * (segments - 1)), 0, segments - 1), start = Math.min(a, b), end = Math.max(a, b), radius = clamp(to.x / 2, 1.05, 5.4); for (let segment = start; segment <= end; segment += 1) radii[segment] = Math.min(radii[segment], radius); }
      for (let segment = 0; segment < segments; segment += 1) { matrix.compose(new THREE.Vector3(0, 0, -segment * segmentLength), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Vector3(radii[segment], radii[segment], 1)); stock.setMatrixAt(segment, matrix); } stock.instanceMatrix.needsUpdate = true;
      const head = visible.at(-1) ?? { x: 54, z: 2, cutting: false, line: 0 }; tool.position.set(0, 0, head.z); tool.children[0].position.x = head.x / 2 + 3; tool.children[1].position.x = head.x / 2; contact.position.set(head.x / 2, 0, head.z); contact.color.set(live.accent); contact.intensity = head.cutting ? 8 : 0; stockGroup.rotation.z = live.spindle ? time * .012 : 0;
      const radius = 35; camera.position.set(Math.sin(drag.yaw) * Math.cos(drag.pitch) * radius, Math.sin(drag.pitch) * radius + 4, Math.cos(drag.yaw) * Math.cos(drag.pitch) * radius - 10); camera.lookAt(0, 0, -13); renderer.render(scene, camera); animation = requestAnimationFrame(draw); };
    animation = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animation); observer.disconnect(); canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up); scene.traverse((node) => { if (node instanceof THREE.Mesh || node instanceof THREE.InstancedMesh) { node.geometry.dispose(); const materials = Array.isArray(node.material) ? node.material : [node.material]; materials.forEach((material) => material.dispose()); } }); renderer.dispose(); };
  }, []);
  const head = props.points[Math.min(Math.max(0, props.frame - 1), props.points.length - 1)] ?? { x: 0, z: 0 };
  return <div className={styles.turnPreview}><canvas ref={canvasRef} aria-label="Interactive 3D turning cell. Drag to orbit; normal page scrolling remains available."/><div className={styles.turnReadout}><b>LIVE TURNING STOCK / XZ SIM</b><span>X Ø{head.x.toFixed(2)} · Z {head.z.toFixed(2)}</span><span>{props.spindle ? "SPINDLE LIVE" : "SAFE STOP"} · {props.coolant ? "COOLANT ON" : "DRY"}</span></div></div>;
}
