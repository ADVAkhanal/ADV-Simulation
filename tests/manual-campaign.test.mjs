import assert from "node:assert/strict";
import test from "node:test";
import { MANUAL_CONTRACTS, MILL_TOOLS, createManualStock, cutManualStock, gradeManualRun, isManualTarget } from "../app/manual-campaign-engine.ts";

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
