"use client";

export type ToolpathEvent =
  | "landing_view" | "flagship_start" | "cycle_start" | "first_cut"
  | "inspection_complete" | "retry_start" | "retry_ready" | "result_share"
  | "asset_ready" | "asset_fallback";

const STORAGE_KEY = "toolpath-anonymous-events-v1";

export function trackAnonymous(event: ToolpathEvent, data: Record<string, string | number | boolean> = {}) {
  if (typeof window === "undefined") return;
  const safeData = Object.fromEntries(Object.entries(data).filter(([, value]) =>
    typeof value === "boolean" || typeof value === "number" || (typeof value === "string" && value.length <= 48),
  ));
  try {
    const previous = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    const events = Array.isArray(previous) ? previous.slice(-99) : [];
    events.push({ event, at: new Date().toISOString(), ...safeData });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch { /* analytics never interrupts the simulation */ }
}
