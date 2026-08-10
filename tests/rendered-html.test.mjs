import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the finished Project Toolpath game surface", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Project Toolpath \| Precision Manufacturing Game Prototype<\/title>/i);
  assert.match(html, /MANUAL CAMPAIGN \/ RETENTION GATE/);
  assert.match(html, /Emergency drive plate/);
  assert.match(html, /Flight rib prototype/);
  assert.match(html, /Sensor bracket/);
  assert.match(html, /2 PLAYABLE MODES/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Codex is working/i);
});

test("ships responsive, accessible, persistence-backed gameplay interactions", async () => {
  const [campaign, campaignCss, globalCss, packageJson] = await Promise.all([
    readFile(new URL("../app/manual-campaign.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/manual-campaign-retention.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(campaign, /onPointerDown=/);
  assert.match(campaign, /onKeyDown=\{jog\}/);
  assert.match(campaign, /toolpath-manual-campaign-v3/);
  assert.match(campaign, /FINAL DISPOSITION/);
  assert.match(campaignCss, /@media \(max-width: 700px\)/);
  assert.match(globalCss, /prefers-reduced-motion:reduce/);
  assert.match(packageJson, /"factory": "node tools\/game-factory\.mjs"/);
});
