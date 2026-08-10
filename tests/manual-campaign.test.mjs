import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MANUAL_SAVE,
  MANUAL_CONTRACTS,
  MILL_CELLS,
  MILL_COLS,
  MILL_ROWS,
  MILL_TOOLS,
  allManualOperationsComplete,
  appendShopRunLog,
  buildManualMeasurements,
  createManualFinishMap,
  createManualStock,
  cutManualStock,
  deriveFlowPoints,
  deriveManualMission,
  deriveShopSkillProgress,
  evaluateManualDisposition,
  gradeManualRun,
  isFixtureZone,
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

test("cutting into the vise clamp zone is a real fixture collision, not just an overcut",()=>{
  const contract=MANUAL_CONTRACTS[0]; const stock=createManualStock();
  const edgeCut=cutManualStock(stock,contract.id,0,0,MILL_TOOLS[0].radius);
  assert.ok(edgeCut.fixtureStrikes>0,"cutting at the grid corner must register a fixture strike");
  const centerCut=cutManualStock(stock,contract.id,(MILL_COLS-1)/2,(MILL_ROWS-1)/2,MILL_TOOLS[0].radius);
  assert.equal(centerCut.fixtureStrikes,0,"cutting well inside the stock must not register a fixture strike");
  for (const contractDef of MANUAL_CONTRACTS) for (let row=0;row<MILL_ROWS;row+=1) for (let col=0;col<MILL_COLS;col+=1) {
    assert.ok(!(isFixtureZone(col,row)&&isManualTarget(contractDef.id,col,row)), `${contractDef.id} target geometry must clear the vise clamp margin at (${col},${row})`);
  }
  const fullyCleared=new Uint8Array(MILL_COLS*MILL_ROWS).map((_,i)=>isManualTarget(contract.id,i%MILL_COLS,Math.floor(i/MILL_COLS))?1:0);
  const clean=gradeManualRun(fullyCleared,contract,0,0,12,0,0);
  const struck=gradeManualRun(fullyCleared,contract,0,0,12,0,1);
  assert.equal(clean.accepted,true,"an otherwise-perfect run with no fixture strikes should be accepted");
  assert.equal(struck.accepted,false,"the identical run with one fixture strike must void acceptance");
  assert.ok(struck.breakPenalty>clean.breakPenalty,"a fixture strike must cost more than an identical clean run");
});

test("shop progression uses personal-best evidence and deterministic role thresholds",()=>{
  const empty=deriveShopSkillProgress({}); assert.equal(empty.xp,0); assert.equal(empty.currentIndex,0); assert.equal(empty.progress,0);
  const one=deriveShopSkillProgress({drive:{score:88,precision:27,completion:96,elapsed:70,geometry:44,finish:12,time:9}});
  assert.equal(one.xp,88); assert.equal(one.currentIndex,1); assert.equal(one.skills[0].label,"GEOMETRY CONTROL"); assert.equal(one.skills[1].value,90);
  const three=deriveShopSkillProgress({drive:{score:88,precision:27,completion:96,elapsed:70,geometry:44,finish:12,time:9},rib:{score:84,precision:25,completion:94,elapsed:88,geometry:43,finish:11,time:8},bracket:{score:91,precision:29,completion:98,elapsed:104,geometry:45,finish:13,time:9}});
  assert.equal(three.xp,263); assert.equal(three.currentIndex,3); assert.equal(three.progress,100);
});

test("shop log keeps newest inspection evidence within its bounded local ledger",()=>{
  const entry=(id)=>({id,contract:"drive",program:"NS-0142-A",title:"Emergency drive plate",score:80,rank:"B",accepted:true,completion:94,precision:26,finish:11,elapsed:72,overcut:1,at:Number(id)});
  let log=[]; for(let id=0;id<30;id+=1) log=appendShopRunLog(log,entry(String(id)));
  assert.equal(log.length,24); assert.equal(log[0].id,"29"); assert.equal(log.at(-1).id,"6");
});

test("mission stages and flow rewards remain deterministic and grading-independent",()=>{
  assert.deepEqual([0,35,70,90].map(value=>deriveManualMission(value).step),[1,2,3,4]);
  assert.deepEqual(deriveFlowPoints(4,0),{multiplier:1,points:400});
  assert.deepEqual(deriveFlowPoints(4,10),{multiplier:1.5,points:600});
  assert.deepEqual(deriveFlowPoints(4,99),{multiplier:2,points:800});
});
