import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const skipLint = args.has("--skip-lint");
const skipTests = args.has("--skip-tests");
const keepStaging = args.has("--keep-staging");
const requiredDesignInputs = [
  "VISION.md", "GAME_DESIGN.md", "FEATURE_INVENTORY.md", "ROADMAP.md",
  "SIMULATION_SPEC.md", "TEST_PLAN.md", "ASSET_PROVENANCE.md", "RELEASE_PLAN.md",
];

function run(label, command, commandArgs) {
  console.log(`\n[factory] ${label}`);
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}.`);
}

function runNpm(label, npmArgs) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("npm_execpath is unavailable. Run the factory through npm or build_game.ps1.");
  run(label, process.execPath, [npmCli, ...npmArgs]);
}

async function exists(relativePath) {
  try { await stat(path.join(root, relativePath)); return true; } catch { return false; }
}

async function walk(directory, base = directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(full, base));
    else output.push({ full, relative: path.relative(base, full).replaceAll("\\", "/") });
  }
  return output;
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

function stamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "-");
}

async function main() {
  const started = new Date();
  const missing = [];
  for (const input of requiredDesignInputs) if (!await exists(input)) missing.push(input);
  if (missing.length) throw new Error(`Missing production inputs: ${missing.join(", ")}`);
  if (!await exists("assets/provenance.json")) throw new Error("Missing assets/provenance.json release manifest.");

  const provenance = JSON.parse(await readFile(path.join(root, "assets/provenance.json"), "utf8"));
  const blockedUsedAssets = provenance.assets.filter((asset) => asset.usedInBuild && !asset.approvedForRelease);
  if (blockedUsedAssets.length) throw new Error(`Used assets lack release approval: ${blockedUsedAssets.map((asset) => asset.path).join(", ")}`);

  if (!skipLint) runNpm("Lint production sources", ["run", "lint"]);
  if (!skipTests) runNpm("Build and run gameplay regressions", ["test"]);
  else runNpm("Build playable output", ["run", "build"]);

  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const buildId = `${packageJson.name}-${packageJson.version}-${stamp(started)}`;
  const artifactsRoot = path.join(root, "artifacts");
  const staging = path.join(artifactsRoot, buildId);
  const reports = path.join(staging, "reports");
  await mkdir(reports, { recursive: true });
  await cp(path.join(root, "dist"), path.join(staging, "playable"), { recursive: true });
  await cp(path.join(root, "CHANGELOG.md"), path.join(staging, "CHANGELOG.md"));
  await cp(path.join(root, "README.md"), path.join(staging, "README.md"));

  const playableFiles = await walk(path.join(staging, "playable"));
  const buildManifest = {
    schemaVersion: 1,
    buildId,
    generatedAt: started.toISOString(),
    platform: "web-cloudflare-worker",
    entrypoint: "playable/server/index.js",
    verification: { lint: !skipLint, tests: !skipTests, build: true },
    files: await Promise.all(playableFiles.map(async (file) => ({ path: `playable/${file.relative}`, bytes: (await stat(file.full)).size, sha256: await sha256(file.full) }))),
  };
  await writeFile(path.join(reports, "build-manifest.json"), `${JSON.stringify(buildManifest, null, 2)}\n`);
  await writeFile(path.join(reports, "asset-provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);
  await writeFile(path.join(reports, "sbom-lite.json"), `${JSON.stringify({ schemaVersion: 1, name: packageJson.name, version: packageJson.version, generatedAt: started.toISOString(), dependencies: packageJson.dependencies, devDependencies: packageJson.devDependencies }, null, 2)}\n`);
  await writeFile(path.join(reports, "verification.md"), `# Build verification\n\n- Build ID: \`${buildId}\`\n- Design inputs: ${requiredDesignInputs.length} validated\n- Production lint: ${skipLint ? "skipped by explicit flag" : "passed"}\n- Build and automated tests: ${skipTests ? "build passed; tests skipped by explicit flag" : "passed"}\n- Gameplay checks: ${skipTests ? "not run" : "full configured suite passed"}\n- Used release assets blocked by provenance: 0\n- Output files hashed: ${playableFiles.length}\n\nThis artifact is the browser vertical slice. Unreal, Blender/OpenUSD, native audio middleware, Steam packaging, and self-hosted CI are future gated production stages, not implied by this build.\n`);

  const archive = path.join(artifactsRoot, `${buildId}.zip`);
  run("Package playable artifact", "tar.exe", ["-a", "-c", "-f", archive, "-C", artifactsRoot, buildId]);
  const latest = { buildId, archive: path.basename(archive), sha256: await sha256(archive), generatedAt: started.toISOString() };
  await writeFile(path.join(artifactsRoot, "latest-build.json"), `${JSON.stringify(latest, null, 2)}\n`);
  if (!keepStaging) await rm(staging, { recursive: true, force: true });
  console.log(`\n[factory] PLAYABLE BUILD READY\n${archive}\nSHA-256 ${latest.sha256}`);
}

main().catch((error) => {
  console.error(`\n[factory] FAILED: ${error.message}`);
  process.exitCode = 1;
});
