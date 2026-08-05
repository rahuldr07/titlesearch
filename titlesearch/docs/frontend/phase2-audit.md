# Phase 2 audit — the classification docs against the export we actually have

**Run 2026-07-27 for `apps/web-v2`.** The five Phase 2 deliverables already existed, written
2026-07-26. Owner direction was audit, not regenerate — the same treatment that caught two
real defects in the token set.

**Verdict: the documents hold.** Every load-bearing claim was re-verified against the export
in `design-export/` and none failed. Three corrections and one inconsistency are below; none
invalidates a classification.

---

## 1. The docs were written against a different build of the design

`design-classification.md:1–4` names its source as
`design-mock/TitlePipe reviewer flow-handoff.zip → TitlePipe.dc.html`, **3,485 lines**.

What is in the repo now is `design-export/TitlePipe reviewer.zip → TitlePipe.dc.html`,
**3,536 lines** — 51 lines longer, at a different path. `design-mock/` does not exist.

This is confirmed independently by line drift on the two specific line numbers the docs cite:

| Doc reference | Doc line | Actual line | Drift |
|---|---:|---:|---:|
| `PROVENANCE AUDIT 07/25/2026` comment | 2130 | **2162** | +32 |
| Status-stamp five-branch `if/else` | 2723 | **2757** | +34 |

Consistent with growth earlier in the file. **Every claim still verified true**, so the 51
lines are additive and did not change any classified behaviour — but line references in the
Phase 2 docs are stale and should not be trusted for navigation.

---

## 2. Re-verified claims — all hold

Checked mechanically against the current export.

| # | Claim | Source | Result |
|---|---|---|---|
| 1 | Zero `localStorage` / `sessionStorage` | classification §1 | ✅ 0 occurrences |
| 2 | No confidence UI; one demo string `'17 (low confidence)'` | C10 | ✅ exactly 1 occurrence, in a `current:` value |
| 3 | No approve-all / accept-remaining / bulk control | classification §1 | ✅ 0 matches for any bulk vocabulary |
| 4 | The design audits its own evidence (`PROVENANCE AUDIT`) | classification §1 | ✅ present at 2162 |
| 5 | Status stamp is a five-branch client state machine | **C2** | ✅ at 2757–2761 |
| 6 | Counts (`auto`, `noSource`) derived in the browser | **C1** | ✅ at 2751–2753, `noSource: total-autoc-flaggedCount` |
| 7 | Correction flow has **no reason field** | **C8** | ✅ `✎ Correct it` fires `onCorrect` directly |
| 8 | Escalation flow has **no question field** | **C9** | ✅ — and worse than recorded, see §3.1 |
| 9 | Escalation resolve treats the rule as **optional** | **C11** | ✅ line 1061: *"**If** this ruling should generalise…"* |
| 10 | No A/B dual reading, no engine attribution | **C7** | ✅ no `readings`, `reader a/b`, `gemini`, `llmwhisperer` anywhere |
| 11 | 19 screens + chrome | classification §3 | ✅ 18 `screen===` ids + the failure screen |
| 12 | `held` and `failed_recoverable` **are** drawn, against BRIEF §10's prediction | state-coverage §1 | ✅ 26 `held` occurrences, 4-state Held vocabulary |

Claim 12 is worth restating because BRIEF §10 asserts the opposite as a near-certainty:

> *"expect **no `failed_recoverable` and no `held` states** anywhere in the export. Generators design the happy path."*

`state-coverage.md` §1 already flagged this as falsified and this audit confirms it
independently. The brief's model of the design is wrong here, and the export is better than
predicted — it has a dedicated Held section, an "Off the pipeline" band, and a States Gallery
whose stated purpose is *"States, not just the happy path."*

---

## 3. Corrections

### 3.1 C9 is understated — the design **fabricates** the missing reason

`conflicts.md` / `design-classification.md` record C9 as *"↗ Escalate — no question field."*
Accurate but incomplete. Line 2681:

```js
escalateField(fieldId){ this.setState(s=>({escalations:[...,
  {fieldId, by:'R. Delacroix',
   reason:(s.signoffComments[fieldId]||'Escalated from review'), …}]})); }
```

It does not merely omit the question — when none exists it **substitutes the literal string
`'Escalated from review'`**. An escalation therefore arrives carrying a reason that no human
wrote.

That is a materially worse conflict than a missing field. A missing input is visibly missing;
a fabricated default is indistinguishable downstream from a real one, and the senior resolving
it has no way to tell. It violates the same INVARIANT (`review.spec` #6) plus principle 6 —
never emit a value you cannot cite.

**Action:** C9's entry should record the fabrication, not just the omission. The redraw needs a
required question *and* the removal of any default.

### 3.2 `component-inventory.md` §5 undercounts the untokenised colours

It lists **8** raw hex literals with no token. The export contains **12**. Missing from the list:

| Literal | Uses | What it is |
|---|---:|---|
| `#5a3fa0` | 4 | mid-violet border on a violet callout |
| `#232327` | 4 | ink on a rendered page (Serif, leading 1.95) |
| `#2a2a2e` | 2 | ink on a scanned page (Mono, leading 2.1) |
| `#33333a` | 1 | ink on a degraded scan |

All four were found and tokenised during the Phase 1 audit (`tokens.md` §6.1) — so the gap is
closed, but the inventory's count is wrong and should not be cited as complete.

### 3.3 My own Phase 1 extraction had a scope limit — recorded

`tokens.md` §1 says values were extracted "exhaustively." That is true only within
`style="…"` attributes and `<style>` blocks, which is where the design's styling lives — but
it is not the whole file. Cross-checking against a whole-file hex scan found **`#eceef2`**,
which my extraction missed because it sits outside both.

No consequence — `#eceef2` was already tokenised as `--color-chip-neutral-surface` — but the
method's boundary is now stated rather than implied. A whole-file scan finds 32 distinct
6-digit hex literals; the style-scoped scan finds 31 of them.

---

## 4. One internal inconsistency between the docs

**How many arms does the no-value component have?** Three different answers are on record:

| Source | Arms | Composition |
|---|---:|---|
| `component-inventory.md` §2.1 | **5** | `pending` + 4 NA reasons |
| `decisions.md` D3 (owner, ratified) | **5** | 4 `NaReason` members + `pending` as a non-enum render |
| `state-coverage.md` §2.2b | **6** | the above + `unsettled` |

The sixth arm is real and was **found on screen during the in-place Pass 3, not by any test**.
The contract encodes two different situations identically — both arrive as
`value: null, na_reason: null`:

1. *not yet extracted* — the pipeline has not reached this field;
2. *the engines read it and disagreed* — nothing merged, but `readings` holds two candidates.

Only the presence of `readings` separates them. Rendering the second as the first tells a
reviewer there is nothing to look at while two candidate values sit in the payload — precisely
the defect orphan **O8** (`ux.spec` "a both-found disagreement never claims emptiness") exists
to catch. That spec was skipped at the time, so nothing caught it; a screenshot did.

**This is the single most valuable thing in the Phase 2 docs for a fresh build**, because a
fresh build has no screenshot and the spec that would catch it is still skipped. `NoValue` must
be built with **six** arms, and `component-inventory.md` §2.1 should be corrected from five.

The associated **CONTRACT GAP** stands: these two states should be distinguishable on the wire,
so a client that forgets to consult `readings` cannot silently claim absence.

---

## 5. One live risk introduced by the scaffold

`component-inventory.md` §1 maps 17 design elements onto shadcn primitives. BRIEF §4 requires
shadcn initialised on **Base UI**, not Radix, and the scaffold installed
`@base-ui-components/react@1.0.0-rc.0` accordingly.

**RESOLVED 2026-07-27.** The deprecation had a clean cause: the package was **renamed to
`@base-ui/react`** as a breaking change in v1.0.0 ("Rename packages to use the @base-ui org").
`@base-ui-components/react` is frozen at `1.0.0-rc.0` and never shipped a stable 1.0.0.

`apps/web-v2` now depends on **`@base-ui/react@1.6.0`** — a stable release, not a release
candidate. No source file ever imported the old package, so the swap was dependency-only.
Base UI stays the choice per §4; it was never the library that was wrong, only the name.

---

## 6. What was not re-derived

The classification itself. 61 RENDER / 16 RULE / 16 CONFLICT was not re-counted element by
element, because the audit's purpose was to test whether the existing analysis still describes
the file in hand. On twelve independently checked load-bearing claims it does, including all
three release-blocking conflicts. Re-deriving the remaining classifications would have cost far
more than it could plausibly find.

The three release-blocking conflicts against harvested INVARIANT specs are unchanged and
confirmed present in the current export:

| | Conflict | Breaks |
|---|---|---|
| **C8** | correction with no reason | `review.spec` #4 |
| **C9** | escalation with no question — **and a fabricated default** | `review.spec` #6 |
| **C11** | escalation resolve with the rule optional | `escalations.spec` #1 |

None can be built as drawn. All three need a redraw before their screens are implementable.
