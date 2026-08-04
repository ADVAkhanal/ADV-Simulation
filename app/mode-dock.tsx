import { Box, Code2, Factory, Layers3 } from "lucide-react";
import styles from "./mode-dock.module.css";

export default function ModeDock() {
  return <nav className={styles.dock} aria-label="Project Toolpath game modes">
    <div className={styles.identity}><Layers3/><span>PROJECT TOOLPATH</span><b>2 MODES + ASSET LAB</b></div>
    <a href="/"><Factory/><span><small>HANDS-ON CELL</small>MANUAL MILL</span></a>
    <a href="/gcode"><Code2/><span><small>PROGRAMMING CELL</small>G//CODE STAGE</span></a>
    <a href="/lab/asset-pipeline"><Box/><span><small>BLENDER PIPELINE</small>ASSET LAB</span></a>
  </nav>;
}
