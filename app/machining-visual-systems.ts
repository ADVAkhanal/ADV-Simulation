import * as THREE from "three";

export type MachineCameraMode = "establishing" | "operator" | "machining" | "macro" | "datum" | "inspection" | "tool-change" | "release" | "failure";
export type ProcessVisualState = {
  spindle: boolean;
  load: number;
  heat: number;
  condition: number;
  finishPenalty: number;
  cameraMode: MachineCameraMode;
};

export const CAMERA_PRESETS: Record<MachineCameraMode, { yaw: number; pitch: number; distance: number; target: THREE.Vector3 }> = {
  establishing: { yaw: -.72, pitch: -.34, distance: 1280, target: new THREE.Vector3(0, -60, 0) },
  operator: { yaw: -.42, pitch: -.24, distance: 1060, target: new THREE.Vector3(0, -90, 25) },
  machining: { yaw: -.16, pitch: -.5, distance: 790, target: new THREE.Vector3(0, -120, 10) },
  macro: { yaw: -.08, pitch: -.64, distance: 430, target: new THREE.Vector3(0, -165, 0) },
  datum: { yaw: -.02, pitch: -.88, distance: 720, target: new THREE.Vector3(0, -150, 0) },
  inspection: { yaw: .05, pitch: -.72, distance: 610, target: new THREE.Vector3(0, -155, 0) },
  "tool-change": { yaw: .61, pitch: -.34, distance: 820, target: new THREE.Vector3(76, -118, -18) },
  release: { yaw: -.48, pitch: -.48, distance: 700, target: new THREE.Vector3(0, -130, 0) },
  failure: { yaw: -.35, pitch: -.42, distance: 650, target: new THREE.Vector3(0, -135, 0) },
};

export function damp(current: number, target: number, speed: number, delta: number) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-speed * delta));
}

export function deriveMachineMood(state: ProcessVisualState) {
  if (state.condition <= 0) return "failure" as const;
  if (state.load >= 92 || state.heat >= 90) return "critical" as const;
  if (state.load >= 78 || state.heat >= 76 || state.finishPenalty >= 5) return "warning" as const;
  if (state.spindle && state.load > 0) return "cutting" as const;
  if (state.spindle) return "spindle" as const;
  return "idle" as const;
}

export function qualityBudget(width: number) {
  if (width < 720) return { dpr: 1, chips: 36, mist: 54, shadows: false };
  if (width < 1200) return { dpr: 1.35, chips: 64, mist: 96, shadows: true };
  return { dpr: 1.75, chips: 96, mist: 144, shadows: true };
}

export function surfaceState(finishPenalty: number, load: number, heat: number) {
  const distress = THREE.MathUtils.clamp(finishPenalty / 8 + Math.max(0, load - 76) / 45 + Math.max(0, heat - 72) / 55, 0, 1);
  return {
    distress,
    color: new THREE.Color().lerpColors(new THREE.Color(0x51686e), new THREE.Color(0x765148), distress),
    roughness: THREE.MathUtils.lerp(.36, .92, distress),
    metalness: THREE.MathUtils.lerp(.78, .42, distress),
  };
}
