# `CONFLICT` — ALL-CAPS labels: rule 4 and the design say no, the frozen specs say yes

**Status: UNRESOLVED. Needs an owner ruling — the fix edits invariant specs.**
**Raised:** 2026-08-28, while assembling the Examination Workstation.
**Governing procedure:** the rebuild brief — *"Never edit an invariant or weaken a test assertion;
if a screen cannot be built without it, that is a `CONFLICT` in the design, so stop and write it
up."* This file is that write-up. The change was made, measured against the specs, and **reverted.**

---

## 1. What is ALL-CAPS, and where it comes from

Two modules bake capitals into STRINGS rather than into CSS:

- `src/features/review/fieldNaming.ts:49,53` — `fieldLabel()` calls `.toUpperCase()` twice, so
  `owner.zip` renders as `OWNER ZIP` and `mortgages.1.lender` as `MTG 1 — LENDER`.
- `src/features/review/panelRubric.ts:45-64` — `NOT YET EXTRACTED`, `AUTO-CONFIRMED`,
  `NEEDS REVIEW`, `ESCALATED — AWAITING A RULE`, `N/A — EXPECTED IN THIS JURISDICTION`,
  `SEARCHED — NOTHING OF RECORD`, `INSTRUMENT SILENT`, `PRESENT — UNREADABLE`.
- `src/features/review/RowValue.tsx:51,61` — `N/A — EXPECTED`, `N/A — INSTRUMENT SILENT`.

## 2. Why that reads as a defect

**Rule 4** (`claude-design-rules.md`): *"Sentence case everywhere. ALL-CAPS only: sidebar rubrics
(11px, .14em) and serif certificate headings."* A field label in the decision queue is neither, and
neither is a state rubric in the decision panel.

**The same file already knows.** `fieldNaming.ts:70` — `sectionTitle()` carries the comment
*"Sentence case (rule 4) — this one IS prose"* — two lines below `fieldLabel()` doing the opposite.

**The design agrees, and independently.** Sampled out of `reference-app.html`: **95 authored labels,
and NOT ONE is ALL-CAPS.** Its register is sentence and title case throughout — "HELOC Deed of
Trust — First Horizon", "Trustee tax schedule 2019–2025", "Settings & RBAC".

**No gate can see it.** `check-rules`' `caps-outside-rubric` rule (added 2026-08-28) reads CLASS
LISTS, so it catches `uppercase` as a utility and is blind to capitals inside a string literal.

## 3. Why it cannot be fixed here

The strings are pinned by the harvested invariant specs as observable behaviour — `toHaveText`, so
exact and case-sensitive:

| spec | line | assertion |
|---|---|---|
| `e2e/invariants/server-owns-state.spec.ts` | 81, 96 | `toHaveText("OWNER ZIP")` |
| `e2e/invariants/review-refusals.spec.ts` | 83 | `toHaveText("MTG 1 — LENDER")` |
| `e2e/invariants/review-refusals.spec.ts` | 105, 135, 182 | `toHaveText("OWNER ZIP")` |
| `e2e/invariants/hard.spec.ts` | 68 | `toHaveText("OWNER ZIP")` |
| `e2e/invariants/navigation.spec.ts` | 34, 45, 52 | `toHaveText("OWNER ZIP")` |
| `e2e/invariants/server-owns-state.spec.ts` | 97, 100 | `toContainText("NEEDS REVIEW"/"AUTO-CONFIRMED")` |
| `e2e/invariants/review.spec.ts` | 24 | `toContainText("N/A — EXPECTED")` |

Ten-plus assertions across five spec files. Changing `fieldLabel` to sentence case was tried and
**breaks every one of them**, and editing them to match is the move the brief forbids by name.

`docs/INVARIANTS.md:22-23` is the reason the ban exists: *"Selectors, markup, framework and visual
language are all disposable. **The assertions are not.**"*

## 4. The real question for the owner

Is the casing **visual language** (disposable, and rule 4 governs it) or **observable behaviour**
(pinned, and the specs govern it)?

The honest answer is that it is visual language which was pinned by accident. The specs are
asserting WHICH FIELD is selected; `OWNER ZIP` is just how that field's name happened to render on
the day they were written. `toHaveText` made the casing load-bearing without anyone deciding it
should be. But that is a reading of intent, and the brief says a rule that blocks a screen is a
conflict to report, not a requirement to reinterpret.

## 5. The options

**Option A — Rule that casing is visual language. Fix the source; update the assertions.**
(Recommended.) `fieldLabel` and `panelRubric` go to sentence case, and the twelve assertions change
case with them. **This is the only option that edits invariant specs, and it must be an explicit
ruling, recorded here, before anybody does it.** The assertions keep asserting the same fact — which
field, which state — so nothing is weakened; only the spelling moves.

**Option B — Loosen the assertions instead of the strings.** Replace `toHaveText("OWNER ZIP")` with
a case-insensitive match, leaving the render free. **Cost:** small. **Risk:** this genuinely IS
weakening an assertion, and it leaves the rule 4 violation on screen — the worst of both.

**Option C — Rule that the decision panel's 11px tracked labels ARE a rubric register**, and widen
rule 4's exception from "sidebar rubrics" to "rubrics". **Cost:** one line in
`claude-design-rules.md`. **Risk:** "rubric" then means whatever a screen says it means, and the
rule stops constraining anything. It also still contradicts the design's own 95 labels.

**Option D — Leave it. This file is the record.** What ships today.

## 6. What must not happen

- **Do not edit the twelve assertions without a recorded ruling.** The brief names this, and an
  agent has already twice marked invariants superseded on a ruling nobody made.
- **Do not "fix" only `panelRubric` and leave `fieldLabel`,** or the workstation shouts in one
  column and whispers in the next.
- **Do not add `.toUpperCase()` anywhere new.** Whatever is ruled, the count should not grow —
  and `caps-outside-rubric` cannot stop you, because it reads classes and not strings.
