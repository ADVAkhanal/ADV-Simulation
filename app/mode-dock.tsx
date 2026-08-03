import Link from "next/link";
import { Code2, Factory, Layers3 } from "lucide-react";
import styles from "./mode-dock.module.css";

export default function ModeDock() {
  return <nav className={styles.dock} aria-label="Project Toolpath game modes">
    <div className={styles.identity}><Layers3/><span>PROJECT TOOLPATH</span><b>2 PLAYABLE MODES</b></div>
    <Link href="/"><Factory/><span><small>HANDS-ON CELL</small>MANUAL MILL</span></Link>
    <Link href="/gcode"><Code2/><span><small>PROGRAMMING CELL</small>G//CODE STAGE</span></Link>
  </nav>;
}
