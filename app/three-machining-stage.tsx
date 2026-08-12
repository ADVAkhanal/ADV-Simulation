"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ManualContract } from "./manual-campaign-engine";
import { CAMERA_PRESETS, damp, deriveMachineMood, qualityBudget, surfaceState, type MachineCameraMode } from "./machining-visual-systems";

type Props = {
  cursor: { x: number; y: number };
  spindle: boolean;
  load: number;
  heat?: number;
  condition?: number;
  finishPenalty?: number;
  material?: string;
  accent?: string;
  cells?: Uint8Array;
  contractId?: ManualContract["id"];
  toolpath?: Array<{ x: number; y: number }>;
  toolId?: number;
  autoOrbit: boolean;
  resetToken: number;
  interactive: boolean;
  cameraMode?: MachineCameraMode;
  datumVisible?: boolean;
  inspectionActive?: boolean;
  inputMode?: "orbit" | "cut";
  soundEnabled?: boolean;
  onToolInput?: (x: number, y: number, cutting: boolean) => void;
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
  const floorGrid = new THREE.GridHelper(1500, 30, 0x274148, 0x14282d);
  floorGrid.position.y = -408;
  floorGrid.material.transparent = true;
  floorGrid.material.opacity = 0.42;
  scene.add(floorGrid);

  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(1500, 760),
    new THREE.MeshStandardMaterial({ color: 0x081215, metalness: 0.36, roughness: 0.82 }),
  );
  backWall.position.set(0, -26, -550);
  scene.add(backWall);
  const paintedSteel = new THREE.MeshStandardMaterial({ color: 0x1c343a, roughness: 0.58, metalness: 0.7 });
  const safetyYellow = new THREE.MeshStandardMaterial({ color: 0xd58d2f, emissive: 0x341300, emissiveIntensity: .25, roughness: .46, metalness: .46 });
  const warmScreen = new THREE.MeshStandardMaterial({ color: 0x101b1b, emissive: 0x65e6d3, emissiveIntensity: 1.45, roughness: .4, metalness: .2 });
  const rack = new THREE.Group();
  const uprightGeometry = new THREE.BoxGeometry(18, 270, 18), shelfGeometry = new THREE.BoxGeometry(250, 12, 62);
  for (const x of [-118, 118]) { const upright = new THREE.Mesh(uprightGeometry, paintedSteel); upright.position.set(x, -270, 0); rack.add(upright); }
  for (const y of [-350, -250, -150]) { const shelf = new THREE.Mesh(shelfGeometry, paintedSteel); shelf.position.set(0, y, 0); rack.add(shelf); }
  for (let index = 0; index < 9; index += 1) { const bin = new THREE.Mesh(new THREE.BoxGeometry(42, 28, 52), index % 3 === 0 ? safetyYellow : steel); bin.position.set(-86 + (index % 3) * 86, -320 + Math.floor(index / 3) * 100, -12); rack.add(bin); }
  rack.position.set(-510, 0, -405); scene.add(rack);
  const cart = new THREE.Group();
  const cartBody = new THREE.Mesh(new THREE.BoxGeometry(150, 18, 95), safetyYellow); cartBody.position.y = -285; cart.add(cartBody);
  for (const x of [-57, 57]) for (const z of [-34, 34]) { const wheel = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 10, 16), steel); wheel.rotation.x = Math.PI / 2; wheel.position.set(x, -326, z); cart.add(wheel); }
  const cartScreen = new THREE.Mesh(new THREE.BoxGeometry(76, 48, 7), warmScreen); cartScreen.position.set(0, -220, -12); cart.add(cartScreen); const cartNeck = new THREE.Mesh(new THREE.BoxGeometry(10, 68, 10), paintedSteel); cartNeck.position.set(0, -254, 0); cart.add(cartNeck);
  cart.position.set(450, 0, -300); scene.add(cart);
  const gantry = new THREE.Group();
  const gantryMat = new THREE.MeshStandardMaterial({ color: 0x11262b, roughness: .62, metalness: .66 });
  for (const x of [-510, 510]) { const column = new THREE.Mesh(new THREE.BoxGeometry(34, 670, 34), gantryMat); column.position.set(x, -76, -500); gantry.add(column); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1054, 34, 34), gantryMat); beam.position.set(0, 246, -500); gantry.add(beam); scene.add(gantry);
  return { slab, bays, lights, floorGrid, warmScreen };
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
    const initial = CAMERA_PRESETS[propsRef.current.cameraMode ?? "establishing"];
    const view = { yaw: initial.yaw, pitch: initial.pitch, distance: initial.distance, target: initial.target.clone() };
    let lastReset = propsRef.current.resetToken;

    scene.add(new THREE.HemisphereLight(0xccefff, 0x071014, 1.35));
    const key = new THREE.DirectionalLight(0xe8fbff, 5.4);
    key.position.set(-520, 740, 420); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); scene.add(key);
    const workLight = new THREE.PointLight(0xffad66, 13, 850, 2);
    workLight.position.set(-150, 120, 220); scene.add(workLight);
    const rim = new THREE.PointLight(0x27d9ff, 9, 1200, 2);
    rim.position.set(480, 180, -380); scene.add(rim);
    const shop = proceduralShop(scene);

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

    const pathMaterial = new THREE.LineBasicMaterial({ color: 0x6feaff, transparent: true, opacity: .85, depthWrite: false });
    const pathGeometry = new THREE.BufferGeometry();
    const completedPath = new THREE.Line(pathGeometry, pathMaterial); completedPath.frustumCulled = false; root.add(completedPath);
    const activePath = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .95, depthWrite: false })); activePath.frustumCulled = false; root.add(activePath);

    const datum = new THREE.Group();
    const datumPlaneMaterial = new THREE.MeshBasicMaterial({ color: 0x31ddff, transparent: true, opacity: .1, side: THREE.DoubleSide, depthWrite: false });
    const datumPlane = new THREE.Mesh(new THREE.PlaneGeometry(270, 165), datumPlaneMaterial); datumPlane.rotation.x = -Math.PI / 2; datum.add(datumPlane);
    datum.add(new THREE.AxesHelper(95));
    const datumRing = new THREE.Mesh(new THREE.RingGeometry(7, 9, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })); datumRing.rotation.x = -Math.PI / 2; datum.add(datumRing);
    datum.visible = false; root.add(datum);

    const scanner = new THREE.Mesh(new THREE.PlaneGeometry(290, 180), new THREE.MeshBasicMaterial({ color: 0x85f5ff, transparent: true, opacity: .13, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    scanner.rotation.x = -Math.PI / 2; scanner.visible = false; root.add(scanner);

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

    let frame = 0, previous = performance.now(), drag: { x: number; y: number } | null = null, cutting = false, firstCutAt = 0, wasCutting = false, stockHovered = false;
    let audio: AudioContext | null = null, motor: OscillatorNode | null = null, harmonic: OscillatorNode | null = null, motorGain: GainNode | null = null;
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const resize = () => {
      const rect = canvas.getBoundingClientRect(), budget = qualityBudget(rect.width), ratio = Math.min(devicePixelRatio || 1, budget.dpr);
      renderer.shadowMap.enabled = budget.shadows;
      renderer.setPixelRatio(ratio); renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
      camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height); camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();

    const emitTool = (event: PointerEvent, isCutting: boolean) => {
      if (!stock || !stockBox) return;
      const rect = canvas.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(stock, true)[0];
      stockHovered = Boolean(hit);
      if (!hit) return;
      const size = stockBox.getSize(new THREE.Vector3());
      propsRef.current.onToolInput?.(
        THREE.MathUtils.clamp((hit.point.x - stockBox.min.x) / size.x, 0, 1),
        THREE.MathUtils.clamp((hit.point.z - stockBox.min.z) / size.z, 0, 1),
        isCutting,
      );
    };
    const armAudio = () => {
      if (!propsRef.current.soundEnabled || audio) return;
      const AudioCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      audio = new AudioCtor(); motorGain = audio.createGain(); motorGain.gain.value = .0001; motorGain.connect(audio.destination);
      motor = audio.createOscillator(); motor.type = "sawtooth"; motor.frequency.value = 62;
      harmonic = audio.createOscillator(); harmonic.type = "sine"; harmonic.frequency.value = 124;
      const harmonicGain = audio.createGain(); harmonicGain.gain.value = .18;
      motor.connect(motorGain); harmonic.connect(harmonicGain).connect(motorGain); motor.start(); harmonic.start();
    };
    const onDown = (event: PointerEvent) => { if (!propsRef.current.interactive) return; armAudio(); canvas.setPointerCapture(event.pointerId); if (propsRef.current.inputMode === "cut" && event.button === 0) { cutting = true; emitTool(event, true); } else drag = { x: event.clientX, y: event.clientY }; };
    const onMove = (event: PointerEvent) => { if (cutting) { emitTool(event, true); return; } if (propsRef.current.inputMode === "cut" && !drag) { emitTool(event, false); return; } if (!drag) return; view.yaw += (event.clientX - drag.x) * 0.008; view.pitch = THREE.MathUtils.clamp(view.pitch + (event.clientY - drag.y) * 0.006, -0.9, 0.12); drag = { x: event.clientX, y: event.clientY }; };
    const onUp = () => { drag = null; cutting = false; };
    const onLeave = () => { stockHovered = false; };
    const onWheel = (event: WheelEvent) => { if (!propsRef.current.interactive) return; event.preventDefault(); view.distance = THREE.MathUtils.clamp(view.distance + event.deltaY * 0.75, 760, 1900); };
    const onContextLost = (event: Event) => { event.preventDefault(); propsRef.current.onFailure(); };
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove); canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp); canvas.addEventListener("pointerleave", onLeave); canvas.addEventListener("wheel", onWheel, { passive: false }); canvas.addEventListener("webglcontextlost", onContextLost);

    const animate = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000); previous = now;
      const live = propsRef.current;
      if (audio && motor && harmonic && motorGain) { const target = live.soundEnabled && live.spindle ? .026 + live.load * .00048 : .0001; motorGain.gain.setTargetAtTime(target, audio.currentTime, .08); motor.frequency.setTargetAtTime(58 + live.load * .9, audio.currentTime, .07); harmonic.frequency.setTargetAtTime(116 + live.load * 2.4, audio.currentTime, .07); }
      const mood = deriveMachineMood({ spindle: live.spindle, load: live.load, heat: live.heat ?? 20, condition: live.condition ?? 100, finishPenalty: live.finishPenalty ?? 0, cameraMode: live.cameraMode ?? "establishing" });
      const liveCut = live.spindle && live.load > 4;
      if (liveCut && !wasCutting) firstCutAt = performance.now();
      wasCutting = liveCut;
      const requestedMode: MachineCameraMode = mood === "failure" || mood === "critical" ? "failure" : live.spindle && live.load > 4 && performance.now() - firstCutAt < 2600 ? "macro" : live.cameraMode ?? (live.spindle ? "machining" : "operator");
      const preset = CAMERA_PRESETS[requestedMode];
      if (live.resetToken !== lastReset) { lastReset = live.resetToken; view.yaw = preset.yaw; view.pitch = preset.pitch; view.distance = preset.distance; view.target.copy(preset.target); }
      if (live.autoOrbit && live.inputMode !== "cut" && !matchMedia("(prefers-reduced-motion: reduce)").matches) view.yaw += dt * 0.045;
      if (!drag) { view.yaw = damp(view.yaw, preset.yaw, 2.4, dt); view.pitch = damp(view.pitch, preset.pitch, 2.4, dt); view.distance = damp(view.distance, preset.distance, 2.2, dt); view.target.lerp(preset.target, 1 - Math.exp(-2.2 * dt)); }
      const vibration = mood === "critical" ? Math.sin(now * .11) * 4.5 : mood === "warning" ? Math.sin(now * .075) * 1.35 : 0;
      camera.position.set(
        view.target.x + Math.sin(view.yaw) * Math.cos(view.pitch) * view.distance + vibration,
        view.target.y + Math.sin(-view.pitch) * view.distance,
        view.target.z + Math.cos(view.yaw) * Math.cos(view.pitch) * view.distance,
      );
      camera.lookAt(view.target);

      const toolX = (live.cursor.x / 27 - 0.5) * 230, toolZ = (live.cursor.y / 15 - 0.5) * 120;
      movingNodes.forEach((object) => { const base = basePosition.get(object)!; object.position.x = base.x + toolX; object.position.z = base.z + toolZ; });
      const activeTool = TOOL_NODE_BY_ID[live.toolId ?? 1] ?? TOOL_NODE_BY_ID[1];
      toolNodes.forEach((tool) => { tool.visible = tool.name === activeTool; if (live.spindle) tool.rotation.y += dt * 38; });

      model?.updateMatrixWorld(true);
      stock?.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if (!(material instanceof THREE.MeshStandardMaterial)) return;
          material.emissive.setHex(stockHovered ? 0x0b4550 : 0x000000);
          material.emissiveIntensity = stockHovered ? 0.42 : 0;
        });
      });
      const mountedTool = toolNodes.find((tool) => tool.name === activeTool);
      const origin = mountedTool ? mountedTool.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(toolX, -5, toolZ);
      if (requestedMode === "macro") view.target.lerp(origin.clone().add(new THREE.Vector3(0, -8, 0)), 1 - Math.exp(-4 * dt));
      const chipColors = CHIP_COLORS[live.material ?? "6061 AL"] ?? CHIP_COLORS["6061 AL"];
      chipMaterial.color.setHex(live.load > 78 ? chipColors[1] : chipColors[0]);
      const budget = qualityBudget(canvas.clientWidth), activeChipCount = Math.min(chipData.length, Math.round(budget.chips * (.24 + live.load / 90)));
      chips.visible = live.spindle && live.load > 0; chips.count = activeChipCount;
      chipData.forEach((particle, index) => {
        const age = (now * 0.001 * particle.speed + particle.phase) % 1;
        const angle = particle.side * (0.35 + index * 2.399963);
        const distance = particle.radius * age;
        const position = origin.clone().add(new THREE.Vector3(Math.cos(angle) * distance, particle.rise * age - 70 * age * age, Math.sin(angle) * distance));
        particleMatrix.compose(position, new THREE.Quaternion().setFromEuler(new THREE.Euler(age * 8, angle, age * 5)), new THREE.Vector3(1 + index % 3, 0.55, 0.55));
        chips.setMatrixAt(index, particleMatrix);
      });
      chips.instanceMatrix.needsUpdate = true;

      mist.visible = live.spindle; const mistCount = Math.min(180, budget.mist);
      mist.geometry.setDrawRange(0, mistCount);
      for (let index = 0; index < mistCount; index += 1) {
        const age = (now * 0.00022 + index * 0.037) % 1, angle = index * 2.399963;
        mistPositions[index * 3] = origin.x + Math.cos(angle) * age * 95;
        mistPositions[index * 3 + 1] = origin.y + 18 + age * 75;
        mistPositions[index * 3 + 2] = origin.z + Math.sin(angle) * age * 70;
      }
      (mist.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      cutRing.visible = live.spindle; cutRing.position.copy(origin); cutRing.position.y += 2; cutRing.scale.setScalar(0.75 + Math.sin(now * 0.012) * 0.12 + live.load * 0.004);
      (cutRing.material as THREE.MeshBasicMaterial).opacity = live.spindle ? 0.26 + live.load * 0.003 : 0;
      workLight.intensity = live.spindle ? 14 + live.load * .09 : 7 + Math.sin(now * .0014) * .6;
      workLight.color.setHex(mood === "critical" ? 0xff4938 : mood === "warning" ? 0xff9e54 : 0xffbd7c);
      shop.lights.material.emissiveIntensity = live.spindle ? 3.4 + live.load * .018 : 2.25 + Math.sin(now * .0011) * .18;
      shop.warmScreen.emissiveIntensity = live.spindle ? 2.45 + live.load * .018 : 1.45 + Math.sin(now * .0017) * .15;
      shop.floorGrid.material.opacity = live.spindle ? .58 : .42;

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
        const finish = surfaceState(live.finishPenalty ?? 0, live.load, live.heat ?? 20); pocketMaterial.color.copy(finish.color); pocketMaterial.roughness = finish.roughness; pocketMaterial.metalness = finish.metalness;
      }

      if (stockBox) {
        const center = stockBox.getCenter(new THREE.Vector3()), top = stockBox.max.y + 3;
        datum.position.set(center.x, top, center.z); datum.visible = live.datumVisible === true || requestedMode === "datum";
        scanner.visible = live.inspectionActive === true || requestedMode === "inspection"; scanner.position.set(center.x, top + 2, center.z + Math.sin(now * .0014) * stockBox.getSize(new THREE.Vector3()).z * .48);
        if (live.toolpath && live.toolpath.length > 1) {
          const size = stockBox.getSize(new THREE.Vector3()), min = stockBox.min;
          const points = live.toolpath.map(point => new THREE.Vector3(min.x + point.x / 27 * size.x, top + 2.5, min.z + point.y / 15 * size.z));
          pathGeometry.setFromPoints(points); completedPath.visible = true;
          activePath.geometry.dispose(); activePath.geometry = new THREE.BufferGeometry().setFromPoints(points.slice(-Math.min(18, points.length)));
          activePath.visible = live.spindle;
          pathMaterial.color.set(live.accent ?? "#6feaff"); pathMaterial.opacity = live.spindle ? .58 : .82;
        } else { completedPath.visible = false; activePath.visible = false; }
      }

      renderer.render(scene, camera); frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      motor?.stop(); harmonic?.stop(); audio?.close();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp); canvas.removeEventListener("pointerleave", onLeave); canvas.removeEventListener("wheel", onWheel); canvas.removeEventListener("webglcontextlost", onContextLost);
      scene.traverse((object) => { if (object instanceof THREE.Mesh || object instanceof THREE.Points) { object.geometry?.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach((material) => material?.dispose()); } });
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} aria-label="Interactive Three.js machining cell with cinematic camera states, live toolpath, datum reference, chip flight, coolant mist, surface condition, and material removal" />;
}
