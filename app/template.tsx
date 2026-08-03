import Link from "next/link";
import GCodeStage from "./gcode/page";

export default function Template({ children }: Readonly<{ children: React.ReactNode }>) {
  void children;
  return <GCodeStage />;
  // Legacy route output is intentionally retained below for source-history compatibility.
  return <>{children}<Link href="/gcode" aria-label="Open G Code Stage creative coding mode" style={{ position: "fixed", zIndex: 90, right: 18, bottom: 54, padding: "11px 14px", color: "#050708", background: "#d8ff3e", boxShadow: "0 0 24px #d8ff3e55", textDecoration: "none", font: "800 9px var(--font-mono), monospace", letterSpacing: ".08em" }}>G//CODE STAGE →</Link></>;
}
