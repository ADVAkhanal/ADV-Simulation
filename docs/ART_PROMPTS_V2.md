# Project Toolpath — Art Prompt Set V2 (Adversity & Business Layer)

Image-generation prompts for concept art that does **not** yet exist. Generated after a
full visual catalog of all 98 images in the prior concept-art batch.

## Why these specific prompts

The existing art set covers the *happy path* exhaustively — title screen, job select,
material prep, saw cell, setup/changeover, datum probing, tool presetting, prove-out,
roughing, finishing, 5-axis, turning, threading, wire EDM, surface grinding, heat treat,
deburr, CMM, optical comparator, functional fit, first-article gate, release desk,
packing/shipping, shift review, and the career/competency ladder.

What it does **not** cover is everything that makes a shop stressful and a game
interesting: scrap, power loss, cash flow, buying machines, rush jobs, engineering
changes, customer returns, fixture failures, breakdowns, and cyber incidents. Those are
sourced from real grievances on Practical Machinist, Elsmar Cove, and industry
incident reporting — see `docs/INDUSTRY_GRIEVANCES.md` for citations.

## Do NOT regenerate these (already exist)

| Concept | Existing image |
|---|---|
| Worn vs. new tool comparison | `exec-c2049a32` |
| Packing / ready-to-ship | `exec-038d2279` |
| Wrong-alloy blanks at material control | `exec-0b8023fc` |
| Receiving inspection w/ cert + XRF | `exec-1abf7ab4` |
| Competency / career ladder | `exec-fc103143` |
| Tool collision crash screen | `exec-049f1fc4` |
| Quality hold + rework/scrap disposition | `exec-9dc331e2`, `exec-a2d3b3f6` |
| Alarm / feed-hold recovery | `exec-e87a205a` |
| Machine care / preventive maintenance | `exec-11388a29` |
| Contract review / quoting feasibility | `exec-eb5c81a1` |
| Shift planning board | `exec-3f479189` |

---

## Trademark note — read before generating

The existing set has legible real trademarks: **KURT** on a vise, **Mitutoyo** on
metrology instruments, **"HAAS NGC"** and **VF-750** in HUD text. That is fine for
internal concept art but is real exposure in a shipped commercial product, especially
given the game's own "no real shop inventory or controller procedure" disclaimer.

**Every prompt below ends with an unbranded clause. Keep it.** A cleanup pass on the
existing art is worth doing before any public build.

---

## STYLE KIT A — Cinematic Editorial Screen

Paste this block verbatim at the end of any Style A prompt.

```
STYLE: Photorealistic cinematic game screenshot, 16:9 widescreen. Very dark,
desaturated, near-monochrome industrial palette — deep blacks, cool charcoal grays,
brushed aluminum and steel highlights. Single motivated practical light source
(machine worklight or overhead fixture) with strong falloff into shadow. Shallow
depth of field, hero object in sharp focus.

UI OVERLAY: One light warm-gray cardstock panel in the lower-left with a subtle paper
texture, a thin red diagonal accent line in one corner, and fine diagonal hatch marks
along its bottom edge. Type inside is uppercase, thin-weight sans-serif, small, widely
letterspaced (~0.15em), arranged as label/value pairs with generous whitespace.

BUTTONS: A single horizontal row of four outlined action buttons along the bottom
center. Each is a rectangle with chamfered/hexagonal-cut corners, 1px stroke, no fill,
uppercase widely-letterspaced label.

STATUS COLOR: green = pass/accepted, red = fault/hold/reject, amber = warning. Use
color sparingly — it should be the only saturated thing in frame.

IMPORTANT: All machinery, tooling, instruments, and controls must be generic and
completely unbranded. No manufacturer logos, no brand names, no real model numbers
anywhere in the image.
```

## STYLE KIT B — Dense HUD Dashboard

Paste this block verbatim at the end of any Style B prompt.

```
STYLE: Full-screen dark application UI mockup, 16:9 widescreen, photorealistic
render quality. Near-black navy background (#0a0e14) with panelled cards in a slightly
lighter charcoal. Cyan (#4db8e8) accent for data and active states.

HEADER: "PROJECT TOOLPATH" wordmark upper-left, horizontal text nav tabs across the
top, and on the right: "OPERATOR 07", "RANK / CNC MACHINIST II" with a thin progress
bar, and "CREDITS 12,450 CR".

LAYOUT: Three columns — a left list/detail panel, a large center content area, and a
right column of stacked data cards with uppercase muted-gray headers. A thin status
strip runs along the very bottom.

TYPE: All data in monospace. Labels uppercase, muted gray, small, letterspaced. Values
brighter and heavier. Dense but well-organized, aerospace/defense instrumentation feel.

IMPORTANT: All machinery, tooling, and controls must be generic and completely
unbranded. No manufacturer logos, no brand names, no real model numbers anywhere.
```

---

# THE PROMPTS

---

## 01 — SCRAP / PART REJECTED
**Mechanic:** the failure counterpart to the existing "PART COMPLETE / RELEASED" screen.
**Grievance:** decimal-slip scrap, compounding-error scrap runs (Practical Machinist).

```
A machined aluminum bracket sitting on a dark steel surface plate, clearly rejected —
a red REJECT tag with a wire loop lies across it, and a red grease-pencil X is drawn on
one machined face. Beside it, a First Article inspection report with one line circled
in red. A scrap bin is visible, out of focus, in the near background. The lighting is
cold and flat compared to the warm hero lighting of an accepted part — this shot should
feel deliberately joyless.

PANEL TEXT:
PART SCRAPPED
CHARACTERISTIC / BORE 03
NOMINAL 12.500 MM
MEASURED 12.541 MM
DEVIATION +0.041 MM
CAUSE / OFFSET ENTRY ERROR
MATERIAL COST 240 CR
LABOR LOST 04:28
SCRAPPED

BUTTONS: REVIEW ENTRY / VIEW ROOT CAUSE / LOG SCRAP / START REPLACEMENT

[+ STYLE KIT A]
```

---

## 02 — POWER LOSS MID-CUT
**Mechanic:** random interrupt event during an active cycle; drives a line-reactor upgrade purchase.
**Grievance:** shop lost ~$30k of tooling plus ~$20k repair when power dropped mid-cut.

```
The interior of a CNC vertical machining center in near-total darkness. All machine
lights are dead. The only illumination is cold blue-white emergency lighting from
somewhere off-frame and a faint red standby LED on the control pendant. A cutting tool
is frozen buried in an aluminum part mid-cut, motionless, still wet with coolant that
has stopped flowing. Chips sit undisturbed. The control screen is black and reflective.
The mood is total dead silence — a machine that was violently busy one second ago.

PANEL TEXT:
POWER LOSS
CYCLE INTERRUPTED AT 61%
SPINDLE / UNCOMMANDED STOP
TOOL / BURIED IN CUT
SERVO DRIVES / DC BUS FAULT
PART STATUS / SUSPECT
ESTIMATED DAMAGE 3,400 CR
FACILITY / NO LINE CONDITIONING

BUTTONS: INSPECT TOOL / CHECK DRIVES / ASSESS PART / RESTART SEQUENCE

[+ STYLE KIT A]
```

---

## 03 — MANAGER MODE / SHOP FINANCIAL DASHBOARD
**Mechanic:** the director-level layer — cash flow on top of contracts.
**Grievance:** rush customers who are slow to pay; one bad part tanking job margin.

```
A shop business-operations dashboard. The center content area is a cash-flow chart over
13 weeks with a projected line dipping below a marked minimum-balance threshold in week
6, highlighted in amber. The left panel is an accounts-receivable aging list with
customer names, invoice amounts, and day-buckets (CURRENT / 30 / 60 / 90+), with the
90+ rows in red. The right column has stacked cards: CASH POSITION, OPEN CONTRACTS,
WORK IN PROCESS, PAYROLL DUE, MACHINE UTILIZATION.

DATA TO SHOW:
CASH ON HAND 84,200 CR
RECEIVABLES 212,600 CR
90+ DAYS 61,400 CR
PAYROLL DUE / 6 DAYS 48,000 CR
WIP VALUE 97,300 CR
UTILIZATION 63%
PROJECTED SHORTFALL / WEEK 6

Nav tabs across the header: DASHBOARD / CONTRACTS / CUSTOMERS / CASH FLOW / CAPACITY /
PERSONNEL / EQUIPMENT

[+ STYLE KIT B]
```

---

## 04 — USED MACHINE MARKETPLACE LISTING
**Mechanic:** between-contract marketplace; spot the scam or get burned.
**Grievance:** documented serial-scammer listings with stolen photos and rotating fake seller names.

```
A used-machinery marketplace browser. The center area shows one large listing: a
photograph of a vertical machining center that looks slightly too clean and too
well-lit compared to the rest of the interface — deliberately like a stolen stock
photo. Around it, listing metadata. The left panel is a scrollable list of other
listings with small thumbnails and prices. The right column shows SELLER DETAILS and a
VERIFICATION card with several unchecked items.

LISTING TEXT:
4-AXIS VERTICAL MACHINING CENTER
ASKING 18,500 CR
MARKET ESTIMATE 62,000 CR
LOCATION / OUT OF REGION
"PALLETIZED AND READY TO SHIP"
"WIRE TRANSFER ONLY / TODAY"

VERIFICATION CARD (all unchecked, amber):
SERIAL VERIFIED WITH OEM
SELLER HISTORY
IN-PERSON INSPECTION
RIGGING ACCESS CONFIRMED
ESCROW AVAILABLE

Nav tabs: MARKETPLACE / AUCTIONS / WATCHLIST / MY EQUIPMENT

[+ STYLE KIT B]
```

---

## 05 — AUCTION LOT / CLOSING BID
**Mechanic:** last-second sniping is correct strategy; a cheap win can hide an extraction cost.
**Grievance:** machine sat at $1 for a week then got sniped in the final 30 minutes; auction bargain that couldn't fit through the building door.

```
A dim industrial auction hall at the end of a sale — rows of machine tools with paper
lot numbers taped to them, most of the overhead lights already switched off, a few
people packing up in the far background. In the foreground, one machine tool with a lot
tag. The mood is the last ten minutes of an auction: quiet, tense, nearly over.

PANEL TEXT:
LOT 214 / CLOSING
3-AXIS VERTICAL MILL
CURRENT BID 2,100 CR
BIDDERS 3
TIME REMAINING 00:41
CONDITION / SOLD AS-IS
INSPECTION / NOT PERFORMED
REMOVAL DEADLINE 5 DAYS
NOTE / DOORWAY CLEARANCE UNKNOWN

BUTTONS: INSPECT LOT / CHECK CLEARANCE / PLACE BID / WALK AWAY

[+ STYLE KIT A]
```

---

## 06 — MATERIAL CERT MISMATCH, FOUND LATE
**Mechanic:** the paper says one thing, the metal is another — discovered after machining.
**Grievance:** shop ordered 6082-T651, received 5083-O; paperwork still claimed the ordered alloy, no mill cert ever provided.

```
An inspection bench with three already-machined parts lined up, finished and deburred —
clearly hours of work. Next to them, a hardness tester with a fresh indentation on a
test coupon and a digital readout. Beside that, a delivery note and a certificate of
conformity, with two values circled in red pencil that do not agree. A material tag
still wired to a piece of remnant bar stock. The tension is entirely in the paperwork,
not the parts — the parts look perfect.

PANEL TEXT:
MATERIAL NONCONFORMANCE
ORDERED / ALLOY A — T651 TEMPER
CERTIFICATE STATES / ALLOY A — T651
HARDNESS TEST INDICATES / ALLOY B — ANNEALED
MILL CERT / NOT SUPPLIED
PARTS AFFECTED 3 OF 3
OPERATIONS COMPLETE / ALL
DISPOSITION REQUIRED

BUTTONS: RETEST COUPON / REQUEST MILL CERT / QUARANTINE LOT / NOTIFY CUSTOMER

[+ STYLE KIT A]
```

---

## 07 — CHIP CONVEYOR CLOG / NEGLECTED SUMP
**Mechanic:** small-diameter work gradually clogs the conveyor; ignore it and the cycle stalls.
**Grievance:** owners of brand-new machines report factory chip conveyors choke on fine swarf, forcing shop-floor workarounds.

```
The chip conveyor discharge end of a CNC machine, pulled out for access. It is packed
solid with fine wet aluminum swarf — matted, stringy, oil-soaked — jammed at the
discharge chute. Below it a chip cart overflows. Nearby, a makeshift shop fix: a mesh
paint strainer bag zip-tied over the discharge, sagging and full. The coolant visible in
the sump is cloudy and dark. Everything is grimy. This should look genuinely unpleasant
and neglected — the opposite of the clean preventive-maintenance imagery.

PANEL TEXT:
CHIP EVACUATION FAULT
CONVEYOR LOAD 96%
SWARF TYPE / FINE — SMALL DIAMETER TOOLING
COOLANT CONCENTRATION / OUT OF RANGE
SUMP CONDITION / CONTAMINATED
CYCLES SINCE SERVICE 412
RISK / RECIRCULATED CHIPS
UNSCHEDULED DOWNTIME IMMINENT

BUTTONS: CLEAR DISCHARGE / DRAIN SUMP / CHECK CONCENTRATION / RESUME CYCLE

[+ STYLE KIT A]
```

---

## 08 — SHATTERED TOOL AFTERMATH
**Mechanic:** the consequence beat after an overspeed or over-engagement mistake.
**Grievance:** thermal-shock insert failure; inserts shattering in under five minutes.

```
Extreme macro shot on a dark steel surface plate: a destroyed solid-carbide end mill.
Two flutes are snapped clean off, the fracture faces bright and crystalline against the
dark coating. Fragments of carbide are scattered around it. Beside it, the mating part
shows a gouged, torn witness mark where the tool failed in the cut. A tool holder lies
on its side. Very shallow depth of field, hard raking light picking out the fracture
surfaces — this should look like forensic evidence photography.

PANEL TEXT:
TOOL FAILURE
TOOL T06 / 6.00 MM 4-FLUTE CARBIDE
FAILURE MODE / CATASTROPHIC FRACTURE
LIFE AT FAILURE 31%
CONTRIBUTING / THERMAL CYCLING
COOLANT / INTERMITTENT
PART CONDITION / GOUGED
TOOL COST 180 CR

BUTTONS: REVIEW COOLANT / INSPECT PART / REPLACE TOOL / LOG FAILURE

[+ STYLE KIT A]
```

---

## 09 — RUSH JOB / EXPEDITE REQUEST
**Mechanic:** accept the credit bonus, but the payout lands on a delay timer and wrecks the schedule.
**Grievance:** customers who demand expedited turnaround are frequently the same accounts that are slow to pay.

```
A shop office desk at the edge of the floor, late in the day. A desk phone with the
handset off the hook rests on a printed production schedule that has been re-marked in
red pen — jobs crossed out and re-ordered. A drawing for a different part sits half
under it. Through the office window behind, the shop floor is visible with machines
running. A cold cup of coffee. The feeling is an interruption that has just blown up a
plan that was working.

PANEL TEXT:
EXPEDITE REQUEST
CUSTOMER / EXISTING ACCOUNT
PAYMENT HISTORY / NET 90 — 2 LATE
REQUESTED DELIVERY 48 HOURS
STANDARD LEAD TIME 12 DAYS
EXPEDITE PREMIUM +25%
SCHEDULE IMPACT / 3 JOBS DISPLACED
DECISION REQUIRED

BUTTONS: REVIEW SCHEDULE / CHECK PAYMENT HISTORY / QUOTE PREMIUM / DECLINE

[+ STYLE KIT A]
```

---

## 10 — ENGINEERING CHANGE ORDER MID-RUN
**Mechanic:** absorb the change free (margin hit) or push back and log a change order (delay, protected payout).
**Grievance:** undocumented scope creep absorbed as unpaid work silently erodes margin.

```
A programming desk with two versions of the same engineering drawing laid side by side
under a task lamp. The left print is worn and marked up from shop use, stamped REV B.
The right print is crisp and clean, stamped REV C, with three dimension callouts
highlighted where they differ. A partially machined part sits on the desk between them —
already cut to the old revision. A red pen rests on the new print.

PANEL TEXT:
REVISION CHANGE / IN PROCESS
DRAWING REV B TO REV C
PARTS COMPLETE TO REV B 4 OF 12
CHANGES / 3 DIMENSIONS
REWORK POSSIBLE / 2 OF 4
SCRAP REQUIRED / 2 OF 4
CHANGE ORDER / NOT ISSUED
ABSORBED COST IF UNBILLED 1,900 CR

BUTTONS: COMPARE REVISIONS / ASSESS REWORK / ISSUE CHANGE ORDER / ABSORB COST

[+ STYLE KIT A]
```

---

## 11 — CUSTOMER AUDIT / NONCONFORMANCE FINDING
**Mechanic:** you fixed the part correctly but get cited for how you documented it.
**Grievance:** real AS9100 findings for a missing counterfeit-parts procedure, then an incomplete version of that same procedure from a different auditor; a shop cited for "ineffective root cause determination."

```
A quality office conference table, viewed slightly from above. An auditor's open
notebook with handwriting, a laptop turned away from camera, and a printed
nonconformance report form with a clause number and a findings box filled in. Beside it,
a stack of QMS procedure binders with tab dividers, one pulled out and flagged with
sticky notes. A single pen laid across the form. Clinical, even, fluorescent-lit — this
is a bureaucratic threat, not a physical one, and the lighting should be flat and
unforgiving rather than moody.

PANEL TEXT:
AUDIT FINDING / MINOR
CLAUSE 10.2.1
FINDING / INEFFECTIVE ROOT CAUSE DETERMINATION
PART DISPOSITION / CORRECT
DOCUMENTATION / INSUFFICIENT
RESPONSE DUE 30 DAYS
OPEN FINDINGS 2
CERTIFICATION STATUS / AT RISK

BUTTONS: READ FINDING / REVIEW EVIDENCE / DISPUTE FINDING / DRAFT RESPONSE

[+ STYLE KIT A]
```

---

## 12 — CREW / STAFFING ROSTER
**Mechanic:** hire fast and cheap (higher scrap from inexperience) or slow and expensive (fewer mistakes).
**Grievance:** machinist turnover and skilled-trades shortage forcing reactive hiring.

```
A personnel management screen. The center area is a crew roster — rows of shop
personnel, each with a role, a shift assignment, a skill-rating bar across several
competencies (SETUP / PROGRAMMING / INSPECTION / 5-AXIS), and a tenure figure. Two rows
are greyed out and marked VACANT in amber. The left panel is a list of open candidates
with asking rates and experience levels. The right column has cards: HEADCOUNT,
OVERTIME HOURS, TURNOVER RATE, TRAINING BACKLOG.

DATA TO SHOW:
HEADCOUNT 7 OF 9
OVERTIME THIS WEEK 62 HRS
TURNOVER / TRAILING YEAR 28%
AVG TENURE 3.1 YRS
OPEN REQUISITIONS 2
TRAINING BACKLOG 4 QUALIFICATIONS

Candidate list entries should show a spread — e.g. "12 YRS / 34 CR-HR", "2 YRS / 19
CR-HR", "APPRENTICE / 12 CR-HR"

Nav tabs: DASHBOARD / CONTRACTS / CUSTOMERS / CASH FLOW / CAPACITY / PERSONNEL /
EQUIPMENT

[+ STYLE KIT B]
```

---

## 13 — RANSOMWARE / LOCKED CONTROLLER
**Mechanic:** shop-floor IT hygiene; a USB drive event locks a machine until you rebuild or pay.
**Grievance:** a defense-sector precision machining subcontractor hit by ransomware with files tied to major primes; another shop spent $200k+ and five weeks down. Root cause repeatedly cited: legacy unpatchable OS on controllers, USB as infection vector.

```
A CNC machine control pendant in a darkened shop, its screen showing not a machine
interface but a stark full-screen lock message on a black background — plain, ugly
system-font text, deliberately visually foreign against the industrial hardware
surrounding it. The machine itself is dark and idle. A USB flash drive is still plugged
into a port on the control panel. In the soft-focus background, other machines sit
equally dark. Cold light, no warmth anywhere.

PANEL TEXT:
CONTROLLER COMPROMISED
MACHINES AFFECTED 4 OF 6
CONTROL OS / UNSUPPORTED LEGACY
LAST SECURITY UPDATE / NEVER
ENTRY VECTOR / REMOVABLE MEDIA
NETWORK / FLAT — NO SEGMENTATION
PROGRAMS ENCRYPTED / ALL
BACKUPS / LAST VERIFIED 94 DAYS AGO

BUTTONS: ISOLATE NETWORK / CHECK BACKUPS / REBUILD CONTROLLER / CALL RESPONSE

[+ STYLE KIT A]
```

---

## 14 — CUSTOMER RETURN / RMA
**Mechanic:** a quality escape comes back weeks later, after you already got paid and moved on.
**Grievance:** ~20,000 lbs of machined parts returned for warping only detected after delivery; a plating vendor ruining 43 of 235 finished pieces.

```
A receiving area with a returned shipping crate, its lid pried off and leaning against
the side. Inside, machined parts still in their original protective wrapping — but the
wrapping is now cut open and a red rejection tag is wired to the top part. A packing
list and a customer rejection letter sit on the crate lid. The parts look fine at a
glance, which is the point. Harsh overhead dock lighting, concrete floor.

PANEL TEXT:
CUSTOMER RETURN
QUANTITY RETURNED 43 OF 235
REASON / DIMENSIONAL — POST-DELIVERY
DETECTED AT / CUSTOMER INCOMING
DAYS SINCE SHIPMENT 26
INVOICE STATUS / ALREADY PAID
CUSTOMER STANDING / FIRST ESCAPE
CORRECTIVE ACTION REQUIRED

BUTTONS: INSPECT RETURNS / TRACE LOT / REVIEW PROCESS / RESPOND TO CUSTOMER

[+ STYLE KIT A]
```

---

## 15 — WORKHOLDING FAILURE AFTERMATH
**Mechanic:** the consequence of carrying setup over from the previous job without re-verifying.
**Grievance:** jaw pressure left at the prior job's setting; part came loose at speed and the fixture was thrown across the shop.

```
The inside of a machine enclosure after a workholding failure. The vise is empty, its
jaws still closed on nothing. The part is gone from the fixture — visible instead
wedged against the far wall of the enclosure, deeply gouged and deformed. A soft jaw is
cracked. Chips and coolant are sprayed in a violent radial pattern across the enclosure
window and interior. The spindle has stopped. Nothing is on fire and nobody is hurt,
but the scene should read as genuinely violent — this is what "the part came loose"
actually looks like.

PANEL TEXT:
WORKHOLDING FAILURE
CLAMP PRESSURE / 170 — REQUIRED 300
SOURCE / SETTING CARRIED FROM PRIOR JOB
SPINDLE SPEED AT FAILURE 1,500 RPM
PART / UNRECOVERABLE
FIXTURE DAMAGE / SOFT JAW CRACKED
ENCLOSURE / CONTAINED
INJURY / NONE

BUTTONS: REVIEW SETUP LOG / INSPECT FIXTURE / CHECK SPINDLE / RESET CELL

[+ STYLE KIT A]
```

---

## 16 — MACHINE DOWN / SERVICE CALL
**Mechanic:** unscheduled downtime; pay for fast service or wait and lose the schedule.
**Grievance:** unplanned breakdowns and the retrofit costs shops haven't budgeted for.

```
A CNC machine with its rear electrical cabinet standing open, exposing a dense wall of
drives, contactors, and wiring looms. A red DO NOT OPERATE tag hangs from the control
pendant. A service technician's toolbox and a laptop connected by a diagnostic cable
sit on the floor in front of the open cabinet. Task lighting is clipped to the cabinet
door, throwing hard light on the electronics while the rest of the shop falls away into
darkness. The machine is unmistakably dead.

PANEL TEXT:
MACHINE DOWN
UNIT / 3-AXIS VERTICAL MILL
FAULT / SPINDLE DRIVE
DOWNTIME ELAPSED 11 HRS
JOBS DISPLACED 3
SERVICE / NEXT AVAILABLE 4 DAYS
EXPEDITED SERVICE +2,800 CR
PART LEAD TIME 6 DAYS

BUTTONS: REVIEW FAULT / RESCHEDULE JOBS / EXPEDITE SERVICE / SOURCE USED DRIVE

[+ STYLE KIT A]
```

---

## 17 — NIGHT SHIFT / AFTER HOURS
**Mechanic:** an ambient "focus" resource that depletes with overtime and degrades inspection accuracy.
**Grievance:** ~62% of small-business owners report burnout at least monthly; the "can't afford to stop" bind.

```
A wide, quiet shot of a machine shop very late at night. One machine is running, its
enclosure glowing warm in an otherwise completely dark building — every other machine is
off. A single figure is seen from behind at a distance, small in frame, standing at a
bench under one work lamp. Long shadows, cold blue window light from outside contrasting
with the one warm pool of light. Empty. The composition should feel isolated rather than
heroic — the machine is company, and that is the point.

PANEL TEXT:
SHIFT 03 / AFTER HOURS
CONSECUTIVE DAYS WORKED 11
HOURS THIS WEEK 71
MACHINES RUNNING 1 OF 6
NEXT DELIVERY 2 DAYS
INSPECTION ACCURACY / DEGRADED
FOCUS / LOW
CONTINUE OR CLOSE OUT

BUTTONS: KEEP RUNNING / REVIEW TOMORROW / CLOSE OUT SHIFT / GO HOME

[+ STYLE KIT A]
```

---

## Suggested generation order

If generating a subset, these give the most value per image:

1. **01 Scrap** — the missing emotional beat; the whole existing set has no failure outcome
2. **02 Power loss** — cheapest to implement in code, reuses existing cycle state
3. **15 Workholding failure** — pairs with the carried-over-setup trap, also cheap to implement
4. **03 Manager dashboard** — establishes the entire business layer visually
5. **04 Marketplace** — standalone screen, doesn't touch the core loop
6. **08 Shattered tool** — reusable consequence art for several different mistakes

The rest support mechanics that need systems which do not exist yet (staffing, ECO
handling, audit response), so the art will sit unused longer.
