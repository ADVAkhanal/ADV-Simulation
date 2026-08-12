"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ManualContract } from "./manual-campaign-engine";

type Props = {
  cursor: { x: number; y: number };
  spindle: boolean;
  load: number;
  material?: string;
  accent?: string;
  cells?: Uint8Array;
  contractId?: ManualContract["id"];
  toolpath?: Array<{ x: number; y: number }>;
  toolId?: number;
  autoOrbit: boolean;
  resetToken: number;
  interactive: boolean;
  onReady: () => void;
  onFailure: () => void;
};

const TOOL_NODE_BY_ID: Record<number, string> = { 1: "tool.endmill.flat.010", 2: "tool.endmill.rougher.020", 3: "tool.drill.030" };
const CHIP_COLORS: Record<string, [number, number]> = {
  "6061 AL": [0xd4edf0, 0xffb450],
  "7075-T6": [0xe4e3c4, 0xffc45a],
  "Ti-6Al-4V": [0x96b2e8, 0x785ade],
};

type Particle = { phase: number; speed: number; radius: number; rise: number; side: number };

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, index) => ({
    phase: (index * 0.61803398875) % 1,
    speed: 0.7 + (index % 7) * 0.09,
    radius: 18 + (index % 11) * 3.2,
    rise: 9 + (index % 5) * 3,
    side: index % 2 ? 1 : -1,
  }));
}

function proceduralShop(scene: THREE.Scene) {
  const steel = new THREE.MeshStandardMaterial({ color: 0x17262b, roughness: 0.72, metalness: 0.48 });
  const floor = new THREE.MeshStandardMaterial({ color: 0x091114, roughness: 0.92, metalness: 0.18 });
  const slab = new THREE.Mesh(new THREE.PlaneGeometry(1700, 1300), floor);
  slab.rotation.x = -Math.PI / 2;
  slab.position.y = -410;
  slab.receiveShadow = true;
  scene.add(slab);

  const bayGeometry = new THREE.BoxGeometry(34, 520, 34);
  const bays = new THREE.InstancedMesh(bayGeometry, steel, 10);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < 10; index += 1) {
    const side = index < 5 ? -1 : 1;
    const depth = ((index % 5) - 2) * 230;
    matrix.makeTranslation(side * 720, -150, depth);
    bays.setMatrixAt(index, matrix);
  }
  bays.instanceMatrix.needsUpdate = true;
  scene.add(bays);

  const lightGeometry = new THREE.BoxGeometry(260, 8, 24);
  const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xd9f9ff, emissive: 0x8edfff, emissiveIntensity: 2.5 });
  const lights = new THREE.InstancedMesh(lightGeometry, lightMaterial, 5);
  for (let index = 0; index < 5; index += 1) {
    matrix.makeTranslation((index - 2) * 310, 360, -170);
    lights.setMatrixAt(index, matrix);
  }
  scene.add(lights);
  return { slab, bays, lights };
}

export default function ThreeMachiningStage(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  useEffect(() => { propsRef.current = props; }, [props]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      propsRef.current.onFailure();
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050b0e);
    scene.fog = new THREE.FogExp2(0x071014, 0.00105);
    const camera = new THREE.PerspectiveCamera(34, 1, 1, 5000);
    const view = { yaw: -0.72, pitch: -0.34, distance: 1280, target: new THREE.Vector3(0, -60, 0) };
    let lastReset = propsRef.current.resetToken;

    scene.add(new THREE.HemisphereLight(0xccefff, 0x071014, 1.35));
    const key = new THREE.DirectionalLight(0xe8fbff, 5.4);
    key.position.set(-520, 740, 420); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); scene.add(key);
    const workLight = new THREE.PointLight(0xffad66, 13, 850, 2);
    workLight.position.set(-150, 120, 220); scene.add(workLight);
    const rim = new THREE.PointLight(0x27d9ff, 9, 1200, 2);
    rim.position.set(480, 180, -380); scene.add(rim);
    proceduralShop(scene);

    const root = new THREE.Group();
    scene.add(root);
    let model: THREE.Group | null = null;
    const movingNodes: THREE.Object3D[] = [];
    const basePosition = new Map<THREE.Object3D, THREE.Vector3>();
    let stock: THREE.Object3D | null = null;
    const toolNodes: THREE.Object3D[] = [];
    const loader = new GLTFLoader();
    let disposed = false;

    const chipGeometry = new THREE.IcosahedronGeometry(1.7, 0);
    const chipMaterial = new THREE.MeshStandardMaterial({ color: 0xd4edf0, metalness: 0.92, roughness: 0.24, emissive: 0x071014 });
    const chips = new THREE.InstancedMesh(chipGeometry, chipMaterial, 96);
    chips.instanceMatrix.setUsage(THREE.DynamicDrawUsage); chips.frustumCulled = false; root.add(chips);
    const chipData = makeParticles(96), particleMatrix = new THREE.Matrix4();

    const mistPositions = new Float32Array(180 * 3);
    const mist = new THREE.Points(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(mistPositions, 3)),
      new THREE.PointsMaterial({ color: 0x71eaff, size: 4, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    mist.frustumCulled = false; root.add(mist);

    const cutRing = new THREE.Mesh(
      new THREE.RingGeometry(13, 15, 48),
      new THREE.MeshBasicMaterial({ color: 0x78eeff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    cutRing.rotation.x = -Math.PI / 2; root.add(cutRing);

    const pocketMaterial = new THREE.MeshStandardMaterial({ color: 0x33494f, metalness: 0.58, roughness: 0.64 });
    const pocketGeometry = new THREE.BoxGeometry(1, 1, 1);
    let pockets: THREE.InstancedMesh | null = null;
    let stockBox: THREE.Box3 | null = null;

    const forcedFallback = new URLSearchParams(location.search).has("assetFallback");
    if (forcedFallback) { propsRef.current.onFailure(); }
    else loader.load("/assets/workholding/toolpath-machining-kit-v1.glb", (gltf) => {
      if (disposed) return;
      model = gltf.scene;
      model.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true; object.receiveShadow = true;
          const source = object.material as THREE.MeshStandardMaterial;
          if (source?.isMeshStandardMaterial) {
            object.material = source.clone();
            object.material.envMapIntensity = 1.15;
          }
        }
        if (object.name.startsWith("machine.spindle") || object.name.startsWith("machine.coolant") || object.name.startsWith("tool.")) {
          movingNodes.push(object); basePosition.set(object, object.position.clone());
        }
        if (object.name === "stock.block.flagship") stock = object;
        if (object.name.startsWith("tool.")) toolNodes.push(object);
      });
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      model.position.sub(center);
      model.position.y -= 30;
      root.add(model);
      if (stock) stockBox = new THREE.Box3().setFromObject(stock);
      propsRef.current.onReady();
    }, undefined, () => propsRef.current.onFailure());

    let frame = 0, previous = performance.now(), drag: { x: number; y: number } | null = null;
    const resize = () => {
      const rect = canvas.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 2);
      renderer.setPixelRatio(ratio); renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
      camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height); camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();

    const onDown = (event: PointerEvent) => { if (!propsRef.current.interactive) return; drag = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); };
    const onMove = (event: PointerEvent) => { if (!drag) return; view.yaw += (event.clientX - drag.x) * 0.008; view.pitch = THREE.MathUtils.clamp(view.pitch + (event.clientY - drag.y) * 0.006, -0.9, 0.12); drag = { x: event.clientX, y: event.clientY }; };
    const onUp = () => { drag = null; };
    const onWheel = (event: WheelEvent) => { if (!propsRef.current.interactive) return; event.preventDefault(); view.distance = THREE.MathUtils.clamp(view.distance + event.deltaY * 0.75, 760, 1900); };
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove); canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp); canvas.addEventListener("wheel", onWheel, { passive: false });

    const animate = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000); previous = now;
      const live = propsRef.current;
      if (live.resetToken !== lastReset) { lastReset = live.resetToken; view.yaw = -0.72; view.pitch = -0.34; view.distance = 1280; }
      if (live.autoOrbit && !matchMedia("(prefers-reduced-motion: reduce)").matches) view.yaw += dt * 0.085;
      camera.position.set(
        view.target.x + Math.sin(view.yaw) * Math.cos(view.pitch) * view.distance,
        view.target.y + Math.sin(-view.pitch) * view.distance,
        view.target.z + Math.cos(view.yaw) * Math.cos(view.pitch) * view.distance,
      );
      camera.lookAt(view.target);

      const toolX = (live.cursor.x / 27 - 0.5) * 230, toolZ = (live.cursor.y / 15 - 0.5) * 120;
      movingNodes.forEach((object) => { const base = basePosition.get(object)!; object.position.x = base.x + toolX; object.position.z = base.z + toolZ; });
      const activeTool = TOOL_NODE_BY_ID[live.toolId ?? 1] ?? TOOL_NODE_BY_ID[1];
      toolNodes.forEach((tool) => { tool.visible = tool.name === activeTool; if (live.spindle) tool.rotation.y += dt * 38; });

      model?.updateMatrixWorld(true);
      const mountedTool = toolNodes.find((tool) => tool.name === activeTool);
      const origin = mountedTool ? mountedTool.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(toolX, -5, toolZ);
      const chipColors = CHIP_COLORS[live.material ?? "6061 AL"] ?? CHIP_COLORS["6061 AL"];
      chipMaterial.color.setHex(live.load > 78 ? chipColors[1] : chipColors[0]);
      chips.visible = live.spindle;
      chipData.forEach((particle, index) => {
        const age = (now * 0.001 * particle.speed + particle.phase) % 1;
        const angle = particle.side * (0.35 + index * 2.399963);
        const distance = particle.radius * age;
        const position = origin.clone().add(new THREE.Vector3(Math.cos(angle) * distance, particle.rise * age - 70 * age * age, Math.sin(angle) * distance));
        particleMatrix.compose(position, new THREE.Quaternion().setFromEuler(new THREE.Euler(age * 8, angle, age * 5)), new THREE.Vector3(1 + index % 3, 0.55, 0.55));
        chips.setMatrixAt(index, particleMatrix);
      });
      chips.instanceMatrix.needsUpdate = true;

      mist.visible = live.spindle;
      for (let index = 0; index < 180; index += 1) {
        const age = (now * 0.00022 + index * 0.037) % 1, angle = index * 2.399963;
        mistPositions[index * 3] = origin.x + Math.cos(angle) * age * 95;
        mistPositions[index * 3 + 1] = origin.y + 18 + age * 75;
        mistPositions[index * 3 + 2] = origin.z + Math.sin(angle) * age * 70;
      }
      (mist.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      cutRing.visible = live.spindle; cutRing.position.copy(origin); cutRing.position.y += 2; cutRing.scale.setScalar(0.75 + Math.sin(now * 0.012) * 0.12 + live.load * 0.004);
      (cutRing.material as THREE.MeshBasicMaterial).opacity = live.spindle ? 0.26 + live.load * 0.003 : 0;

      if (stockBox && live.cells) {
        const removed = Array.from(live.cells).filter((value) => value === 0).length;
        if (!pockets || pockets.count !== Math.max(1, removed)) {
          if (pockets) { root.remove(pockets); pockets.dispose(); }
          pockets = new THREE.InstancedMesh(pocketGeometry, pocketMaterial, Math.max(1, removed)); root.add(pockets);
        }
        const size = stockBox.getSize(new THREE.Vector3()), min = stockBox.min, cellX = size.x / 28, cellZ = size.z / 16;
        let instance = 0;
        live.cells.forEach((value, index) => { if (value !== 0) return; const col = index % 28, row = Math.floor(index / 28); particleMatrix.compose(new THREE.Vector3(min.x + (col + 0.5) * cellX, stockBox!.max.y + 0.35, min.z + (row + 0.5) * cellZ), new THREE.Quaternion(), new THREE.Vector3(cellX * 0.92, 1.2, cellZ * 0.92)); pockets!.setMatrixAt(instance++, particleMatrix); });
        pockets.count = Math.max(1, instance); pockets.visible = instance > 0; pockets.instanceMatrix.needsUpdate = true;
      }

      renderer.render(scene, camera); frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp); canvas.removeEventListener("wheel", onWheel);
      scene.traverse((object) => { if (object instanceof THREE.Mesh || object instanceof THREE.Points) { object.geometry?.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach((material) => material?.dispose()); } });
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} aria-label="Interactive Three.js machining cell with procedural shop environment, live chip flight, coolant mist, mounted tooling, and material removal" />;
}
