import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server renders the playable manufacturing prototype", async () => {
  const response = await render(); assert.equal(response.status, 200); const html = await response.text();
  assert.match(html, /Project Toolpath \| Precision Manufacturing Game Prototype/);
  assert.match(html, /Emergency/); assert.match(html, /drive plate/); assert.match(html, /ACCEPT CONTRACT/); assert.match(html, /INSPECT PART/);
  assert.doesNotMatch(html, /Start an RFQ|Advanced signal desk|Evidence room/);
});

test("game ships interaction, failure, scoring, and accessible input paths", async () => {
  const [page, engine, css, docs] = await Promise.all([readFile(new URL("../app/page.tsx", import.meta.url), "utf8"), readFile(new URL("../app/game-engine.ts", import.meta.url), "utf8"), readFile(new URL("../app/globals.css", import.meta.url), "utf8"), readFile(new URL("../GAME_DESIGN.md", import.meta.url), "utf8")]);
  assert.match(page, /onPointerDown/); assert.match(page, /ArrowLeft/); assert.match(page, /TOOL BREAK/); assert.match(page, /localStorage/);
  assert.match(engine, /inspectPart/); assert.match(engine, /overcut/); assert.match(css, /prefers-reduced-motion/); assert.match(css, /max-width:760px/); assert.match(docs, /Core loop/);
});
