import assert from "node:assert/strict";
import test from "node:test";
import { MANUAL_CONTRACTS, MILL_COLS, MILL_ROWS, MILL_TOOLS, appendShopRunLog, createManualStock, cutManualStock, deriveFlowPoints, deriveManualMission, deriveShopSkillProgress, gradeManualRun, isFixtureZone, isManualTarget } from "../app/manual-campaign-engine.ts";

test("manual campaign exposes three distinct geometries and tool tradeoffs",()=>{
  assert.equal(MANUAL_CONTRACTS.length,3); assert.equal(MILL_TOOLS.length,3);
  const signatures=MANUAL_CONTRACTS.map(contract=>Array.from({length:448},(_,i)=>isManualTarget(contract.id,i%28,Math.floor(i/28))?1:0).join(""));
  assert.equal(new Set(signatures).size,3); assert.ok(MILL_TOOLS[0].radius<MILL_TOOLS[2].radius); assert.ok(MILL_TOOLS[0].load<MILL_TOOLS[2].load);
});

test("manual campaign cutting and grading are deterministic",()=>{
  const contract=MANUAL_CONTRACTS[0]; const stock=createManualStock();
  const a=cutManualStock(stock,contract.id,0,0,MILL_TOOLS[1].radius); const b=cutManualStock(stock,contract.id,0,0,MILL_TOOLS[1].radius);
  assert.deepEqual(a,b); assert.deepEqual(gradeManualRun(a.material,contract,a.overcut,0,12,0),gradeManualRun(b.material,contract,b.overcut,0,12,0));
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
