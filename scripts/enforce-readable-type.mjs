import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const minimumPx = 12;

async function cssFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? cssFiles(join(directory, entry.name))
    : entry.name.endsWith(".css") ? [join(directory, entry.name)] : []));
  return nested.flat();
}

function readable(source) {
  const explicit = source.replace(/font-size:(\s*)(\d+(?:\.\d+)?)px/g, (match, space, raw) => {
    const size = Number(raw);
    return size < minimumPx ? `font-size:${space}${minimumPx}px` : match;
  });
  return explicit.replace(/font:([^;{}]*?\s)(\d+(?:\.\d+)?)px(?=[/\s])/g, (match, prefix, raw) => {
    const size = Number(raw);
    return size < minimumPx ? `font:${prefix}${minimumPx}px` : match;
  });
}

let changed = 0;
for (const file of await cssFiles(fileURLToPath(new URL("../app", import.meta.url)))) {
  const source = await readFile(file, "utf8");
  const next = readable(source);
  if (next === source) continue;
  await writeFile(file, next);
  changed += 1;
}

console.log(`Readable type floor applied to ${changed} stylesheet${changed === 1 ? "" : "s"}.`);
