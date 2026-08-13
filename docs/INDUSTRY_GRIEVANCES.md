# Industry Grievances — Design Source Material

Real, sourced pain points from working machinists, shop owners, and quality managers,
gathered to ground Project Toolpath's mechanics in things that actually happen rather
than invented game problems.

**Primary sources:** Practical Machinist forums (the main US machinist community, deep
archive of first-hand shop stories), Elsmar Cove (AS9100/ISO quality forum), CDC/MIOSHA
incident investigations, and industry security reporting.

**Sourcing caveat:** Reddit (r/machinists, r/CNC, r/Manufacturing) is largely not
indexed by search engines, so it is under-represented here. Practical Machinist proved
richer anyway — longer threads, named incidents, real dollar figures. If upvote-verified
"most resonant" signal matters later, someone should browse those subreddits logged in.

Two Practical Machinist threads were paywalled from automated access and look like
ready-made grievance catalogs worth opening manually:
[A list of my issues with Siemens NX (CAM)](https://www.practicalmachinist.com/forum/threads/a-list-of-my-issues-with-siemens-nx-cam.448829/)
and Practical Machinist's staff-curated "worst shop stories" article.

---

## (a) Shop floor / operator

| # | Grievance | What happens | Source |
|---|---|---|---|
| 1 | Decimal-slip scrap | `.177` keyed instead of `.117` off a poorly dimensioned drawing — two days of labor and material gone | [PM](https://www.practicalmachinist.com/forum/threads/worst-scrap-stories.254293/) |
| 2 | Compounding-error scrap run | Missing corner-break radii on ~$7,000/ea bushings; the "fix" cut too deep, scrapping 39 consecutive pieces | [PM](https://www.practicalmachinist.com/forum/threads/worst-scrap-stories.254293/) |
| 3 | Warpage found after shipping | ~20,000 lbs of machined plastic returned for warping only measurable post-delivery | [PM](https://www.practicalmachinist.com/forum/threads/worst-scrap-stories.254293/) |
| 4 | Outside process ruins finished parts | Plating vendor destroyed 43 of 235 already-machined pieces; rework deprioritized against new work, delivery slipped ~2 months | [PM](https://www.practicalmachinist.com/forum/threads/vendor-screw-ups-messed-up-parts.397251/) |
| 5 | Hiding scrap under schedule pressure | Workers found to have dumped bad parts (and good ones) into machine sumps rather than report scrap | [PM](https://www.practicalmachinist.com/forum/threads/worst-scrap-stories.254293/) |
| 6 | Overspeed data entry | 3000 RPM entered instead of 300 with 110% override active; tool extension bent 90°, shattered into the ATC. No sanity check on entered values | [CDC/MIOSHA](https://oem.msu.edu/images/MiFACE/04MI180v1.pdf) |
| 7 | Setup carried over from prior job | Jaw pressure left at 170 psi instead of required 300; part came loose at 1,500 RPM and the fixture was thrown across the shop | [CDC/MIOSHA](https://stacks.cdc.gov/view/cdc/167115) |
| 8 | No baseline before tools fail | Tooling that ran fine starts failing in minutes; no wear photos or data from when the process was healthy, so root cause is guesswork | [PM](https://www.practicalmachinist.com/forum/threads/suddenly-breaking-end-mills-in-known-program.314247/) |
| 9 | Thermal-shock insert failure | "Dabbing" coolant with a brush instead of flood or fully dry shatters insert tips | [PM](https://www.practicalmachinist.com/forum/threads/inserts-failing-on-face-mill.364621/) |
| 10 | Chip management on new machines | Factory conveyors choke on fine swarf; shops resort to strainer bags over the discharge or aftermarket conveyors | [PM](https://www.practicalmachinist.com/forum/threads/i-have-a-2023-dnm5700-is-the-coolant-chip-management-really-supposed-to-be-this-terrible.426392/) |

## (b) Programming / CAM

| # | Grievance | What happens | Source |
|---|---|---|---|
| 11 | Post-processor / kinematics mismatch | The post's solver doesn't match the real machine, so paths that simulate clean still gouge or collide — CAM verification is not a guarantee | [NX CAM paper](https://www.researchgate.net/publication/304490925_NX_CAM_post_processing_errors_Machine_data_file_generator_vs_post_builder) |
| 12 | Gouge check must be re-run manually | Collision detection has to be re-run after every geometry or tool change; gouges slip through after "small" edits | [NX CAM guide](https://industrialmonitordirect.com/blogs/knowledgebase/programming-4-axis-groove-toolpaths-in-siemens-nx-cam) |

## (c) Business / management

| # | Grievance | What happens | Source |
|---|---|---|---|
| 13 | Rush customers who pay slowly | Customers demanding expedited turnaround are often the same slow-pay accounts; shops eat schedule disruption without matching cash flow unless they charge a premium (commonly 20–25%) | [PM](https://www.practicalmachinist.com/forum/threads/do-you-charge-an-expedite-fee-for-hot-jobs.267984/) |
| 14 | Undocumented scope creep | Mid-project changes absorbed as unpaid work; even zero-cost changes need documenting or margin silently erodes | [ECO guidance](https://quality.eleapsoftware.com/glossary/engineering-change-order-in-qms-complete-guide/) |
| 15 | Material substituted, cert doesn't match | Ordered 6082-T651, received 5083-O; hardness testing caught it but paperwork still claimed the ordered alloy and no mill cert was ever provided | [PM](https://www.practicalmachinist.com/forum/threads/material-certs-how-do-you-know-if-its-for-what-you-received.314414/) |
| 16 | Certs never travel with the metal | Bar stock arrives with only a sticker; shops chase suppliers for paperwork, undermining heat-number traceability | [PM](https://www.practicalmachinist.com/forum/threads/correlating-material-certs-to-machining-problems.446383/) |
| 17 | Procedure gaps surface as audit hits | Cited for lacking a counterfeit-parts procedure, then cited again by a different auditor for an incomplete version of the same one; a calibration lab quietly falling off the approved supplier list | [Elsmar](https://elsmar.com/elsmarqualityforum/threads/cb-and-internal-auditors-most-common-nonconformities-against-as9100d.71979/) |
| 18 | Cited for root-cause paperwork | Minor NCR under clause 10.2.1 for "ineffective processes in determining causes of nonconformities" — dinged for the analysis, not the defect | [Elsmar](https://elsmar.com/elsmarqualityforum/threads/minor-finding-during-as9100-audit-documentation-in-oasis-incorrect.90731/) |
| 19 | Talent pipeline squeeze | Turnover and skilled-trades shortage force reactive hiring or missed delivery commitments. *Directionally real but under-sourced in this pass* | [NIST](https://www.nist.gov/node/1529026) |
| 20 | Owner burnout | ~62% of small-business owners report burnout at least monthly; 81% report exhaustion in the last year. *Cross-industry data, not machining-specific* | [21hats](https://21hats.substack.com/p/business-owners-say-theyre-burning) |

## (d) Equipment / facilities

| # | Grievance | What happens | Source |
|---|---|---|---|
| 21 | Auction machine, hidden extraction cost | Machine bought cheap at auction, then the seller's doorway was too small to get it out — required structural demolition. Sale price was the smallest cost | [PM](https://www.practicalmachinist.com/forum/threads/machine-auction-results.389720/) |
| 22 | Auction sniping | A machine sat at $1.00 for a week, then got sniped in the final 30 minutes — a low current bid says nothing about real demand | [PM](https://www.practicalmachinist.com/forum/threads/used-cnc-machinery-values.361444/) |
| 23 | Serial-scammer listings | Fraudulent listings reusing stolen photos, rotating fake seller names, "palletized and ready to ship," cycling payment addresses — including one case using a real dealer's identity after they had died | [PM](https://www.practicalmachinist.com/forum/threads/the-scammers-are-thick-beware.413345/page-2) |
| 24 | Power loss mid-cut | Power dropped with multiple lines mid-cut: ~$30k of tooling destroyed plus ~$20k in repairs for machines that wouldn't restart. Servo/VFD drives are the common casualty; line reactors are a retrofit most shops haven't budgeted | [PM](https://www.practicalmachinist.com/forum/threads/power-outages-and-damaged-machine-servo-drives.253507/) |
| 25 | Legacy controllers as ransomware exposure | A defense-sector precision machining subcontractor hit by ransomware with files tied to major primes; another shop spent $200k+ and 5 weeks down. Root cause: unpatchable legacy OS on controllers, USB as vector | [SecurityWeek](https://www.securityweek.com/cnc-machines-vulnerable-hijacking-data-theft-damaging-cyberattacks/) |

---

## Mapping to art and mechanics

See `docs/ART_PROMPTS_V2.md` — each prompt cites the grievance number it dramatizes.
Grievances 7, 9, 24 are the cheapest to implement in code because they reuse machine
state the game already tracks (clamp/setup carryover, coolant boolean, cycle interrupt).
