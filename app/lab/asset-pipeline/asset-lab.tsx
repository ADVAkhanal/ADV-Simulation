"use client";

import { useEffect, useState } from "react";
import FlagshipMachiningKit from "../../flagship-machining-kit";
import GlbPreview from "./glb-preview";
import ParametricGenerator from "./parametric-generator";
import styles from "./asset-pipeline.module.css";

type Mode = "kit" | "test" | "atlas" | "parametric";
type KitManifest = {
  id: string; version: number; path: string; sourceBlend: string; triangleCount: number; materialCount: number; fileSizeBytes: number;
  objects: string[]; materials: string[]; anchors: Record<string, string>; boundingBox: { dimensionsMm: number[] };
};
type TestManifest = { assetId: string; source: string; runtime: string; generator: string; objectCount: number; materialCount: number; sha256: string };

export default function AssetLab() {
  const [mode, setMode] = useState<Mode>("kit");
  return <>
    <nav className={styles.assetSelector} aria-label="Asset Lab asset selector">
      <span>INSPECTION TARGET</span>
      <button className={mode === "kit" ? styles.selectedAsset : ""} onClick={() => setMode("kit")}>MACHINING KIT V1</button>
      <button className={mode === "test" ? styles.selectedAsset : ""} onClick={() => setMode("test")}>TEST ASSET</button>
      <button className={mode === "atlas" ? styles.selectedAsset : ""} onClick={() => setMode("atlas")}>CAPABILITY ATLAS</button>
      <button className={mode === "parametric" ? styles.selectedAsset : ""} onClick={() => setMode("parametric")}>PARAMETRIC GENERATOR</button>
    </nav>
    {mode === "kit" ? <KitInspector/> : mode === "test" ? <TestInspector/> : mode === "parametric" ? <ParametricGenerator/> : <GlbPreview/>}
  </>;
}

function KitInspector() {
  const [manifest, setManifest] = useState<KitManifest | null>(null), [error, setError] = useState("");
  useEffect(() => { fetch("/assets/manifests/toolpath-machining-kit-v1.json").then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }).then(setManifest).catch((reason: Error) => setError(reason.message)); }, []);
  return <section className={styles.kitInspector}>
    <div className={styles.kitViewport}><FlagshipMachiningKit cursor={{ x: 13.5, y: 7.5 }} spindle completion={32} load={48}/></div>
    <aside className={styles.kitData}><span className={styles.kicker}>PRODUCTION ASSET / RUNTIME READY</span><h2>MACHINING<br/>KIT V1</h2>{error && <p className={styles.errorText}>{error}</p>}
      <dl><div><dt>ASSET ID</dt><dd>{manifest?.id ?? "VALIDATING"}</dd></div><div><dt>GEOMETRY</dt><dd>{manifest ? `${manifest.triangleCount.toLocaleString()} TRI / ${manifest.materialCount} MAT` : "—"}</dd></div><div><dt>PAYLOAD</dt><dd>{manifest ? `${(manifest.fileSizeBytes / 1024).toFixed(1)} KB` : "—"}</dd></div><div><dt>BOUNDS</dt><dd>{manifest ? manifest.boundingBox.dimensionsMm.map((value) => `${value}mm`).join(" × ") : "—"}</dd></div></dl>
      <div className={styles.objectMatrix}><span>OBJECTS / {manifest?.objects.length ?? 0}</span>{manifest?.objects.map((name) => <code key={name}>{name}</code>)}</div>
      <div className={styles.anchorMatrix}><span>ANCHOR CONTRACT</span>{manifest && Object.entries(manifest.anchors).map(([role, name]) => <p key={role}><b>{role}</b><code>{name}</code></p>)}</div>
    </aside>
  </section>;
}

function TestInspector() {
  const [manifest, setManifest] = useState<TestManifest | null>(null);
  useEffect(() => { fetch("/assets/manifests/pipeline-smoke-test.json").then((response) => response.json()).then(setManifest); }, []);
  return <section className={styles.testInspector}><div className={styles.testGlyph}><i/><i/><i/><b>GLB</b></div><div><span className={styles.kicker}>MINIMUM VIABLE PIPELINE PROBE</span><h2>TEST ASSET</h2><p>This single-object artifact proves Blender → GLB → browser delivery before production geometry enters the runtime.</p><dl><div><dt>ASSET</dt><dd>{manifest?.assetId ?? "VALIDATING"}</dd></div><div><dt>GENERATOR</dt><dd>{manifest?.generator ?? "—"}</dd></div><div><dt>OBJECTS</dt><dd>{manifest?.objectCount ?? "—"}</dd></div><div><dt>INTEGRITY</dt><dd>{manifest ? `${manifest.sha256.slice(0, 18)}…` : "—"}</dd></div></dl></div></section>;
}
