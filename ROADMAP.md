# ADV-Simulation — Direction & Roadmap

**This repo is the training/sellable-software fork**, forked from
[ADV-Game](https://github.com/ADVAkhanal/ADV-Game) at commit `60321d9` on
2026-08-18. The consumer/arcade direction continues in that repo instead — do not
pull arcade tone or mechanics back into this one; the split exists because the two
audiences need incompatible things from the same underlying engine.

## Positioning

**Generic, unbranded, audio-driven "real machinist" credibility — without paying for
photorealistic simulation.** The buyer is a shop, a trade school, or a workforce
program evaluating this as training infrastructure, not a gamer looking for fun. Every
design decision should be judged against: *does this make the buyer trust that their
operators will learn something real here?*

**The core differentiator, and the biggest-ROI lever:** procedural audio carries the
realism, not graphics. A tool that's about to snap should *sound* like it's about to
snap — rising pitch, harmonic grind, stress harmonics building under the cut tone —
well before the failure event fires. This is cheap to build (pure oscillator/noise
synthesis, the same technique already proven out in the `packages/chiptune-synth`
work in ADV-WI-Studio: Fourier-series waveforms and an LFSR noise generator, zero
sample licensing, zero recording cost) and it's disproportionately effective per
dollar spent compared to chasing physically-based cutting simulation.

## Immediate must-do: trademark cleanup

The inherited art set has real, legible trademarks — **KURT** on the vise, **Mitutoyo**
on calipers/micrometers/height gauges, **"HAAS NGC"** and **VF-750** in HUD text. That
was acceptable as internal concept art; it is real exposure the moment this becomes
sellable software, and it directly contradicts the "no real shop inventory or
controller procedure" framing this product needs for credibility with buyers who will
ask about IP. Every new asset must follow the unbranded clause already written into
`docs/ART_PROMPTS_V2.md`'s style kits — that constraint was written for exactly this
fork. Treat re-generating the branded assets as Phase 0 work, not later cleanup.

## What carries over as-is (don't rebuild)

- The manual mill cutting/telemetry loop and the tolerance/inspection/disposition
  vocabulary — ACCEPT/REWORK/SCRAP and real-feeling measurement language is a feature
  here, not something to soften.
- `ROLE_LADDER`'s O*NET alignment codes (`51-9161.00`, `51-4041.00`, `51-9162.00`) —
  this is a genuine, real credibility hook for workforce-program buyers. Lean into
  it harder: make it the actual curriculum spine instead of flavor text.
- `LEARNING_LENSES`'s three-tier easy/medium/hard explanation depth — this is
  already, almost by accident, the right instructional-design shape (progressive
  disclosure of complexity). Formalize it into real training modules.
- The 5-axis/turning/EDM systems and G-code stage — breadth across machine types is
  a selling point for a training tool in a way it isn't for a game.

## What to strip

- Any silliness, cosmetic customization, or meme-oriented content that ends up in
  the ADV-Game fork after this point — do not merge it back.
- Specific fictional customer/part names if they read as too game-like
  (`NORTHSTAR MOBILITY`, `KESTREL AEROSPACE`) — consider whether generic part-family
  names read as more credible to a training buyer, or whether named contracts still
  serve the curriculum framing. This is a judgment call, not an obvious strip.

## What to add

- **The procedural tool-wear audio system.** Build this as its own package (mirroring
  `packages/chiptune-synth`'s structure): a wear-state input drives pitch/harmonic
  content of the cut tone, culminating in a distinct failure sound. This is the
  headline feature to demo to a buyer.
- **Generic multi-machine-type support as a stated feature**, not an implementation
  detail — a training buyer wants to know operators are learning transferable
  fundamentals (mill, lathe, EDM) rather than one machine's quirks. The groundwork
  already exists from the Three.js systems merge; make it a first-class, advertised
  capability.
- **Assessment/certification export.** A shop or school needs to prove training
  happened — a printable or exportable completion record per operator, tied to the
  role-ladder thresholds that already exist in the save data. This is likely the
  actual thing a buyer is purchasing, more than the simulation itself.
- **An instructor/administrator view** — separate from the operator's play view —
  showing cohort progress, time-on-task, and common failure points. Training software
  is bought by whoever manages the trainees, not by the trainee.

## Roadmap

**Phase 0 — De-risk before anything else.** Scrub trademarks from all inherited art
(regenerate using the unbranded prompts already written). Rename away from
"Project Toolpath" if that title doesn't read as procurement-appropriate — a training
buyer's first impression matters more here than in a consumer game. Do not add the
audio-wear system or new machine types on top of branded art you'll have to redo.

**Phase 1 — Internal pilot at Advanced PMC.** You already have the real customer:
your own shop. Run this as actual onboarding for a real trainee or two, generic
machines and all. This produces the first case study, and it will surface what's
missing far faster than external sales conversations would. Treat this the same way
`WI-1701` was treated in ADV WI Studio — a real pilot, not a demo.

**Phase 2 — Build the audio-wear system and the assessment/instructor view.** These
are the two features that actually differentiate this from "a game that happens to be
about machining." Do this after Phase 1 so the pilot's real feedback shapes what the
instructor view actually needs to show.

**Phase 3 — External pilots.** Trade schools and state manufacturing workforce
programs are the realistic first external buyers — funded, motivated by the same
skilled-trades shortage that's already well-documented, and more reachable than
individual shops without an existing relationship. Lead with the Advanced PMC case
study from Phase 1, not with the product alone.

## Explicit non-goals for this fork

No cosmetic unlockables, no meme/comedy framing, no forgiving-by-default difficulty,
no fictional joke brand — all of that belongs in ADV-Game. Every asset and every
mechanic here should be defensible in a conversation with a training-program
administrator.
