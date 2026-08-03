import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("homepage", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("root URL renders G//CODE Stage instead of the legacy machine floor", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /G\/\/CODE STAGE/);
  assert.match(html, /ACTIVE CONTRACT/);
  assert.match(html, /CYCLE START/);
  assert.doesNotMatch(html, /ACCEPT CONTRACT|INSPECT PART/);
});

test("root template deliberately promotes the campaign to the whole site", async () => {
  const [template, page] = await Promise.all([
    readFile(new URL("../app/template.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/gcode/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(template, /return <GCodeStage/);
  assert.match(page, /INSPECTION FAILED/);
  assert.match(page, /toolpath-contracts/);
});
