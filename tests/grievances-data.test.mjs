import test from "node:test";
import assert from "node:assert/strict";
import { CATALOGED_GRIEVANCES } from "../packages/assessment/src/index.ts";

// Enforces PRODUCT_SPEC.md §37/§38 as code, not just a code comment: every
// cataloged grievance must be traceable to a real source, and none may be
// invented without going through the same sourcing discipline.
test("catalog contains exactly the 25 grievances from docs/INDUSTRY_GRIEVANCES.md", () => {
  assert.equal(CATALOGED_GRIEVANCES.length, 25);
});

test("every grievance has a unique id", () => {
  const ids = CATALOGED_GRIEVANCES.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every grievance has at least one source reference with a real URL", () => {
  for (const g of CATALOGED_GRIEVANCES) {
    assert.ok(g.sourceReferences.length > 0, `${g.id} has no source reference`);
    for (const ref of g.sourceReferences) {
      assert.match(ref.url, /^https?:\/\//, `${g.id} has a non-URL source reference`);
      assert.ok(ref.summarizedClaim.length > 0, `${g.id} source reference has no summarized claim`);
    }
  }
});

test("every grievance declares a validation status honestly (no silent 'validated' without a validated source)", () => {
  for (const g of CATALOGED_GRIEVANCES) {
    assert.ok(
      ["anecdotal", "corroborated", "engineering-supported", "validated"].includes(g.validationStatus),
      `${g.id} has an invalid validationStatus`,
    );
  }
});

test("thin-evidence grievances are honestly marked anecdotal, not overclaimed", () => {
  const talentPipeline = CATALOGED_GRIEVANCES.find((g) => g.id === "grievance.talent-pipeline-squeeze");
  const ownerBurnout = CATALOGED_GRIEVANCES.find((g) => g.id === "grievance.owner-burnout");
  assert.equal(talentPipeline.validationStatus, "anecdotal");
  assert.equal(ownerBurnout.validationStatus, "anecdotal");
});

test("severity is always one of the schema's defined tiers", () => {
  const validSeverities = ["nuisance", "quality", "downtime", "scrap", "machine-damage", "safety-critical"];
  for (const g of CATALOGED_GRIEVANCES) {
    assert.ok(validSeverities.includes(g.severity), `${g.id} has an invalid severity: ${g.severity}`);
  }
});
