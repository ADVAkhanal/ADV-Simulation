"use client";

export type ResultCardData = {
  contract: string; program: string; rank: string; score: number; accepted: boolean;
  geometry: number; precision: number; finish: number; time: number; personalBestDelta: number | null;
};

export async function shareResultCard(data: ResultCardData) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200; canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Result canvas unavailable");
  const gradient = context.createLinearGradient(0, 0, 1200, 630);
  gradient.addColorStop(0, "#071014"); gradient.addColorStop(.7, "#10252b"); gradient.addColorStop(1, "#063745");
  context.fillStyle = gradient; context.fillRect(0, 0, 1200, 630);
  context.strokeStyle = "#50e6ff"; context.lineWidth = 3; context.strokeRect(36, 36, 1128, 558);
  context.fillStyle = "#50e6ff"; context.font = "700 22px monospace"; context.fillText("PROJECT TOOLPATH / INSPECTION RECORD", 74, 92);
  context.fillStyle = "#f2fbfc"; context.font = "800 62px sans-serif"; context.fillText(data.contract.toUpperCase(), 74, 174);
  context.fillStyle = "#809ba2"; context.font = "700 20px monospace"; context.fillText(`${data.program}  /  ${data.accepted ? "PART ACCEPTED" : "INSPECTION HOLD"}`, 76, 218);
  context.fillStyle = "#50e6ff"; context.font = "900 190px sans-serif"; context.fillText(data.rank, 74, 435);
  context.fillStyle = "#ffffff"; context.font = "800 58px sans-serif"; context.fillText(`${data.score} / 100`, 275, 405);
  context.font = "700 18px monospace";
  const stats = [["GEOMETRY", `${data.geometry}/46`], ["PRECISION", `${data.precision}/30`], ["FINISH", `${data.finish}/14`], ["CYCLE", `${data.time}/10`]];
  stats.forEach(([label, value], index) => {
    const x = 650 + (index % 2) * 245, y = 300 + Math.floor(index / 2) * 120;
    context.fillStyle = "#789097"; context.fillText(label, x, y);
    context.fillStyle = "#f2fbfc"; context.font = "800 38px monospace"; context.fillText(value, x, y + 45); context.font = "700 18px monospace";
  });
  context.fillStyle = "#b7cbd0"; context.font = "700 17px monospace";
  context.fillText(data.personalBestDelta === null ? "FIRST BENCHMARK" : `${data.personalBestDelta >= 0 ? "+" : ""}${data.personalBestDelta} VS PERSONAL BEST`, 74, 518);
  context.fillStyle = "#658087"; context.font = "600 14px monospace";
  context.fillText("FICTIONAL TRAINING SIMULATION — NOT MACHINE-OPERATING GUIDANCE", 74, 564);

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Card export failed")), "image/png"));
  const file = new File([blob], "project-toolpath-result.png", { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: "Project Toolpath result", text: `${data.rank} rank — ${data.score}/100`, files: [file] });
    return "SHARE SHEET OPENED";
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob); link.download = file.name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  return "RESULT CARD DOWNLOADED";
}
