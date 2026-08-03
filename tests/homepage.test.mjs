import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("homepage", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("root URL renders the hands-on machine floor", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /THREE MATERIAL SYSTEMS/);
  assert.match(html, /Emergency drive plate/);
  assert.match(html, /Flight rib prototype/);
  assert.match(html, /Sensor bracket/);
  assert.match(html, /MANUAL MILL/);
  assert.match(html, /G\/\/CODE STAGE/);
});

test("G-code route renders the programming campaign as a second mode", async () => {
  const response = await render("/gcode");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /ACTIVE CONTRACT/);
  assert.match(html, /CYCLE START/);
  assert.doesNotMatch(html, /ACCEPT CONTRACT/);
});

test("global mode dock exposes both game surfaces", async () => {
  const [template, dock, page, home, manual] = await Promise.all([
    readFile(new URL("../app/template.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mode-dock.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/gcode/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/manual-campaign.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(template, /ModeDock/);
  assert.match(dock, /MANUAL MILL/);
  assert.match(dock, /G\/\/CODE STAGE/);
  assert.match(page, /INSPECTION FAILED/);
  assert.match(page, /toolpath-contracts/);
  assert.match(page, /scrollIntoView/);
  assert.match(page, /PHI GRID/);
  assert.doesNotMatch(page, /href="#contracts"/);
  assert.doesNotMatch(template, /ExperienceRouter/);
  assert.match(home, /ManualCampaign/);
  assert.match(manual, /THREE MATERIAL SYSTEMS/);
  assert.match(manual, /INSPECT PART/);
});
