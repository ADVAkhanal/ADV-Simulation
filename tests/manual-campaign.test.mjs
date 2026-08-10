import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MANUAL_SAVE,
  MANUAL_CONTRACTS,
  MILL_CELLS,
  MILL_COLS,
  MILL_TOOLS,
  allManualOperationsComplete,
  buildManualMeasurements,
  createManualFinishMap,
  createManualStock,
  cutManualStock,
  evaluateManualDisposition,
  gradeManualRun,
  isManualBoundary,
  isManualTarget,
  machineManualStock,
  manualCellOperation,
  manualOperationProgress,
  migrateManualSave,
  recommendedManualDisposition,
  recordManualAttempt,
} from "../app/manual-campaign-engine.ts";

function cellFor(contractId, operationId) {
  for (let index = 0; index < MILL_CELLS; index += 1) {
    const col = index % MILL_COLS;
    const row = Math.floor(index / MILL_COLS);
    if (manualCellOperation(contractId, col, row) === operationId) return { col, row };
  }
  throw new Error(`No ${operationId} cell for ${contractId}`);
}

function completedRun(contract) {
  const material = createManualStock();
  const finished = createManualFinishMap();
  for (let index = 0; index < MILL_CELLS; index += 1) {
    const col = index % MILL_COLS;
    const row = Math.floor(index / MILL_COLS);
    if (!isManualTarget(contract.id, col, row)) material[index] = 0;
    if (isManualBoundary(contract.id, col, row)) finished[index] = 1;
  }
  return { material, finished };
}

test("manual campaign exposes three contracts, distinct geometry, and all four operations", () => {
  assert.equal(MANUAL_CONTRACTS.length, 3);
  assert.equal(MILL_TOOLS.length, 3);
  const signatures = MANUAL_CONTRACTS.map((contract) => Array.from({ length: MILL_CELLS }, (_, index) => isManualTarget(contract.id, index % MILL_COLS, Math.floor(index / MILL_COLS)) ? 1 : 0).join(""));
  assert.equal(new Set(signatures).size, 3);
  assert.deepEqual(new Set(MANUAL_CONTRACTS.flatMap((contract) => contract.operations.map((operation) => operation.id))), new Set(["profile", "pocket", "drill", "finish"]));
});

test("tools enforce meaningful capabilities instead of cosmetic stat changes", () => {
  const contract = MANUAL_CONTRACTS[0];
  const stock = createManualStock();
  const finish = createManualFinishMap();
  const drillCell = cellFor(contract.id, "drill");
  const wrongTool = machineManualStock(stock, finish, contract.id, "drill", MILL_TOOLS[1], drillCell.col, drillCell.row);
  const drillTool = machineManualStock(stock, finish, contract.id, "drill", MILL_TOOLS[2], drillCell.col, drillCell.row);
  assert.equal(wrongTool.compatible, false);
  assert.equal(wrongTool.engagement, 0);
  assert.equal(drillTool.compatible, true);
  assert.ok(drillTool.correct > 0);
  assert.ok(MILL_TOOLS[0].operations.includes("finish"));
  assert.ok(!MILL_TOOLS[2].operations.includes("profile"));
});

test("multi-operation routing separates pocket, drill, profile, and finish work", () => {
  for (const contract of MANUAL_CONTRACTS) {
    const { material, finished } = completedRun(contract);
    for (const operation of contract.operations) {
      assert.equal(manualOperationProgress(material, finished, contract.id, operation.id), 100);
    }
    assert.equal(allManualOperationsComplete(material, finished, contract), true);
  }
  const rib = MANUAL_CONTRACTS[1];
  assert.doesNotThrow(() => cellFor(rib.id, "pocket"));
  const drive = MANUAL_CONTRACTS[0];
  assert.notDeepEqual(cellFor(drive.id, "profile"), cellFor(drive.id, "drill"));
});

test("active inspection is deterministic, instrument-aware, and gates disposition", () => {
  const contract = MANUAL_CONTRACTS[2];
  const { material, finished } = completedRun(contract);
  const first = buildManualMeasurements(material, finished, contract, 0, 0, 0);
  const second = buildManualMeasurements(material, finished, contract, 0, 0, 0);
  assert.deepEqual(first, second);
  assert.equal(first.every((reading) => reading.pass), true);
  assert.deepEqual(new Set(first.map((reading) => reading.instrument)), new Set(["touch-probe", "bore-gauge", "profilometer"]));
  assert.equal(recommendedManualDisposition(first, contract, 0), "accept");
  assert.deepEqual(evaluateManualDisposition("accept", "accept", 2, 3), { complete: false, correct: false, inspectionScore: 0 });
  assert.deepEqual(evaluateManualDisposition("accept", "accept", 3, 3), { complete: true, correct: true, inspectionScore: 10 });
  assert.equal(recommendedManualDisposition(first, contract, contract.tolerance + 1), "scrap");
});

test("version-two progress migrates and mastery records best accepted attempts", () => {
  const migrated = migrateManualSave({ version: 2, credits: 900, reputation: 7, cleared: ["drive"] });
  assert.equal(migrated.version, 3);
  assert.equal(migrated.credits, 900);
  assert.equal(migrated.mastery.drive?.accepted, true);
  const contract = MANUAL_CONTRACTS[1];
  const grade = { completion: 100, geometry: 40, precision: 25, finish: 15, time: 9, inspection: 10, score: 99, accepted: true, rank: "S", payout: 2000 };
  const recorded = recordManualAttempt({ ...DEFAULT_MANUAL_SAVE, cleared: [], mastery: {} }, contract, grade);
  assert.equal(recorded.totalAttempts, 1);
  assert.equal(recorded.mastery.rib?.bestRank, "S");
  assert.ok(recorded.cleared.includes("rib"));
});

test("legacy cutting and grading remain deterministic", () => {
  const contract = MANUAL_CONTRACTS[0];
  const stock = createManualStock();
  const a = cutManualStock(stock, contract.id, 0, 0, MILL_TOOLS[1].radius);
  const b = cutManualStock(stock, contract.id, 0, 0, MILL_TOOLS[1].radius);
  assert.deepEqual(a, b);
  assert.deepEqual(gradeManualRun(a.material, contract, a.overcut, 0, 12, 0), gradeManualRun(b.material, contract, b.overcut, 0, 12, 0));
});
