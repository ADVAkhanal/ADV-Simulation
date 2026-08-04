import type { Metadata } from "next";
import AssetLab from "./asset-lab";
import styles from "./asset-pipeline.module.css";

export const metadata: Metadata = {
  title: "Asset Pipeline Lab | Project Toolpath",
  description: "Live Blender-to-browser GLB validation for Project Toolpath.",
};

export default function AssetPipelineLab() {
  return <main className={styles.lab}>
    <header className={styles.header}>
      <div><span>CAPABILITY ATLAS / 005</span><h1>MACHINE FORMS.<br/>NO INVENTORY LEAKS.</h1></div>
      <p>Five fictional process archetypes translate a precision shop into an explorable visual language. They teach capability, motion, and risk without exposing manufacturers, models, controllers, quantities, or locations.</p>
    </header>
    <AssetLab />
    <footer className={styles.footer}>
      <span>SOURCE OF TRUTH</span><code>assets-src/blender/toolpath-machine-kit.blend</code>
      <span>RUNTIME CONTRACT</span><code>/assets/manifests/machine-capability-kit.json</code>
    </footer>
  </main>;
}
