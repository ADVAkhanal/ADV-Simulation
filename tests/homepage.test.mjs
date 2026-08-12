import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("homepage", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

async function collectCss(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? collectCss(new URL(`${entry.name}/`, directory))
    : entry.name.endsWith(".css") ? [new URL(entry.name, directory)] : []));
  return nested.flat();
}

async function collectTsx(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? collectTsx(new URL(`${entry.name}/`, directory))
    : entry.name.endsWith(".tsx") ? [new URL(entry.name, directory)] : []));
  return nested.flat();
}

test("every visible button is enabled and wired to an action", async () => {
  const files = await collectTsx(new URL("../app/", import.meta.url));
  const disabled = [], unwired = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const tag of source.match(/<button\b[^>]*>/g) ?? []) {
      if (/\bdisabled(?:=|\s|>)/.test(tag)) disabled.push(`${file.pathname}:${tag}`);
      if (!tag.includes("onClick=") && !tag.includes('type="submit"')) unwired.push(`${file.pathname}:${tag}`);
    }
  }
  assert.deepEqual(disabled, []);
  assert.deepEqual(unwired, []);
});

test("all product stylesheets enforce a readable explicit type floor", async () => {
  const files = await collectCss(new URL("../app/", import.meta.url));
  const offenders = [];
  for (const file of files) {
    const css = await readFile(file, "utf8");
    for (const match of css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px|font:[^;{}]*?\s(\d+(?:\.\d+)?)px(?=[/\s])/g)) {
      const size = Number(match[1] ?? match[2]);
      if (size < 12) offenders.push(`${file.pathname}:${size}px`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("root URL renders the hands-on machine floor", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /AFTER HOURS \/ WELCOME TO YOUR FIRST SHIFT/);
  assert.match(html, /START FIRST PART/);
  assert.match(html, /EXPLORE SAFELY/);
  assert.match(html, /THE CELL IS/);
  assert.match(html, /toolpath-cnc-keyart-v1\.webp/);
  assert.match(html, /CELL 01 \/ READY/);
  assert.match(html, /Emergency drive plate/);
  assert.match(html, /Flight rib prototype/);
  assert.match(html, /Sensor bracket/);
  assert.match(html, /MANUAL MILL/);
  assert.match(html, /G\/\/CODE STAGE/);
});

test("landing key art is a compact project-owned WebP asset", async () => {
  const assetUrl = new URL("../public/assets/keyart/toolpath-cnc-keyart-v1.webp", import.meta.url);
  const [bytes, details] = await Promise.all([readFile(assetUrl), stat(assetUrl)]);
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP");
  assert.ok(details.size > 80_000, "key art should retain useful visual detail");
  assert.ok(details.size < 350_000, "key art should remain practical for the landing route");
});

test("G-code route renders the programming campaign as a second mode", async () => {
  const response = await render("/gcode");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /ACTIVE CONTRACT/);
  assert.match(html, /CYCLE START/);
  assert.doesNotMatch(html, /ACCEPT CONTRACT/);
});

test("asset pipeline route exposes the privacy-safe machine capability atlas", async () => {
  const response = await render("/lab/asset-pipeline");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /CAPABILITY ATLAS/);
  assert.match(html, /fictional process archetypes/);
  assert.match(html, /MACHINE FORMS/);
  assert.match(html, /NO INVENTORY LEAKS/);
  assert.match(html, /machine-capability-kit\.json/);
});

test("global mode dock exposes both game surfaces", async () => {
  const [template, dock, dockCss, page, home, manual, machiningKit] = await Promise.all([
    readFile(new URL("../app/template.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mode-dock.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mode-dock.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/gcode/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/manual-campaign.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/flagship-machining-kit.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(template, /ModeDock/);
  assert.match(dock, /MANUAL MILL/);
  assert.match(dock, /G\/\/CODE STAGE/);
  assert.match(dock, /ASSET LAB/);
  assert.match(dock, /CNC LATHE/);
  assert.match(dock, /href="\/turn"/);
  assert.match(dockCss, /@media\(max-width:680px\).*small\{display:none\}/);
  assert.match(page, /INSPECTION FAILED/);
  assert.match(page, /toolpath-contracts/);
  assert.match(page, /scrollIntoView/);
  assert.match(page, /PHI GRID/);
  assert.doesNotMatch(page, /href="#contracts"/);
  assert.doesNotMatch(template, /ExperienceRouter/);
  assert.match(home, /ManualCampaign/);
  assert.match(manual, /OPEN INSPECTION/);
  assert.match(manual, /FINAL DISPOSITION/);
  assert.match(manual, /SIGN OFF OP/);
  assert.match(manual, /PROCESS PLAN/);
  assert.match(manual, /machineManualStock/);
  assert.match(manual, /LOCKOUT/);
  assert.match(manual, /LockKeyhole/);
  assert.match(manual, /REVIEW FINDINGS/);
  assert.match(manual, /START FIRST PART/);
  assert.match(manual, /FlagshipMachiningKit/);
  assert.match(manual, /SHARE RESULT CARD/);
  assert.match(manual, /COOLANT FIELD/);
  assert.match(manual, /chipsRef/);
  assert.match(manual, /AudioContext/);
  assert.match(manual, /PRODUCTION GEOMETRY/);
  assert.match(manual, /DRIVE INTERFACE/);
  assert.match(manual, /LIGHTWEIGHT RIB/);
  assert.match(manual, /OPTICAL BRACKET/);
  assert.match(manual, /PROFILE \+ BORE/);
  assert.match(manual, /WEBS \+ CONTOUR/);
  assert.match(manual, /BOSS \+ DATUM/);
  assert.match(manual, /animate\(targets/);
  assert.match(manual, /prefers-reduced-motion/);
  assert.match(manual, /3-AXIS MILLING/);
  assert.match(manual, /TURNING/);
  assert.match(manual, /5-AXIS/);
  assert.match(manual, /WIRE EDM/);
  assert.match(manual, /STOCK_VIEW/);
  assert.match(manual, /PROCESS ESTIMATE/);
  assert.match(manual, /METROLOGY \/ VISUAL DOCTRINE/);
  assert.match(manual, /DATUM STACK/);
  assert.match(manual, /CUTTER ENGAGEMENT/);
  assert.match(manual, /SURFACE TRACE/);
  assert.match(manual, /CHIP LOAD \/ SIM/);
  assert.match(machiningKit, /faceLight/);
  assert.match(machiningKit, /HIERARCHY/);
  assert.match(machiningKit, /LIVE CUT FX/);
  assert.match(machiningKit, /METAL PBR/);
  assert.match(manual, /RETRY FOR BETTER SCORE/);
  assert.match(manual, /PERSONAL BEST/);
  assert.match(manual, /CMM PROFILE REPORT \/ SIM/);
  assert.match(manual, /deviationBands/);
  assert.match(manual, /PROFILE TRACE/);
  assert.match(manual, /LEARNING LENS/);
  assert.match(manual, /EXPLANATION DEPTH/);
  assert.match(manual, /First Cut/i);
  assert.match(manual, /Apprentice View/i);
  assert.match(manual, /Engineering View/i);
  assert.match(manual, /fz = F/);
  assert.match(manual, /SHOP SKILL RECORD/);
  assert.match(manual, /CNC OPERATOR ALIGNMENT/);
  assert.match(manual, /MACHINIST \/ SETUP ALIGNMENT/);
  assert.match(manual, /CNC PROGRAMMER ALIGNMENT/);
  assert.match(manual, /skill_level_selected/);
  assert.match(manual, /View \$\{role\.level\}/);
  assert.match(manual, /aria-pressed=\{selectedRoleIndex === index\}/);
  assert.match(manual, /EXPLORE ANY LEVEL/);
  assert.match(manual, /roleDetail/);
  assert.match(manual, /does not certify employment readiness/);
  assert.match(manual, /deriveShopProgress/);
  assert.match(manual, /SHOP LOG/);
  assert.match(manual, /HELP \/ TOUR/);
  assert.match(manual, /TOUR_STEPS/);
  assert.match(manual, /guided_tour_step/);
  assert.match(manual, /Three surfaces\. One shop/);
  assert.match(manual, /Orbit the physical setup/);
  assert.match(manual, /INSPECTION LEDGER/);
  assert.match(manual, /MILESTONE PLATES/);
  assert.match(manual, /LAST 24 RUNS/);
  assert.match(manual, /shop_log_open/);
  assert.match(manual, /3D CUT/);
  assert.match(manual, /LIVE MACHINING CELL/);
  assert.match(manual, /PROCESS MAP/);
  assert.match(manual, /G54 DATUM/);
  assert.match(manual, /view_3d_cut/);
  assert.match(manual, /PRIMARY OBJECTIVE/);
  assert.match(manual, /FLOW PTS/);
  assert.match(manual, /RUN SIGNATURE/);
  assert.match(manual, /SHIFT 01 \/ PAUSED/);
  assert.match(manual, /WASD/);
  assert.match(manual, /deriveManualMission/);
  assert.match(manual, /deriveFlowPoints/);
  assert.match(manual, /SAFE TOOL CHANGE/);
  assert.match(manual, /aria-pressed=\{index === toolIndex\}/);
  assert.doesNotMatch(manual, /disabled=\{spindle\}/);
  assert.match(machiningKit, /variant === "full"/);
  assert.match(machiningKit, /variant === "hero"/);
  assert.match(machiningKit, /DRAG TO ORBIT/);
  assert.match(machiningKit, /AUTO ORBIT/);
  assert.match(machiningKit, /onPointerMove/);
  assert.match(machiningKit, /onWheel/);
  assert.match(machiningKit, /view\.zoom/);
  assert.match(machiningKit, /prefers-reduced-motion/);
});
