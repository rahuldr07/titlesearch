# `CONFLICT` — the design's "4-State NA Taxonomy Matrix" vs `NaReason`

**Status: PARTIALLY RESOLVED. One member needs an owner ruling.**
**Raised:** 2026-08-28, while building the `{{ showNaGuide }}` overlay (`reference-app.html` @214135).
**Governing procedure:** `docs/INVARIANTS.md:26-27` — a design that cannot satisfy a rule is a
conflict in the design. Nothing was weakened; the overlay renders the contract's states.

---

## 0. The premise this was raised under was already stale

The rebuild brief for this overlay says:

> Our contract has exactly TWO: `NOT_PRESENT` and `PRESENT_UNREADABLE`, and the repo's hard rule
> is "Two NA states — never collapse".

**That is no longer true, and had not been true for a month when the overlay was built.**
`packages/contract/src/enums.ts:53-58` ships **four**, widened 2 → 4 and ratified by the owner on
**2026-07-26** — `docs/frontend/open-rulings.md` Q1, recorded again in `decisions.md` D3:

> `packages/contract` `NaReason` widened 2 → 4: `NOT_PRESENT`, `NOT_FOUND`, `NOT_STATED`,
> `PRESENT_UNREADABLE`. Purely additive, so nothing in the surviving screens broke.

Two documents still assert the old pair and should be corrected by whoever owns them — **this
agent did not edit either**, because a rulebook is not fixed by the screen that noticed it:

| Document | What it still says | Line |
|---|---|---|
| `CLAUDE.md` (repo root, Hard rules) | "**Two NA states** — `NOT_PRESENT` vs `PRESENT_UNREADABLE` — never collapse" | Hard rules §4 |
| `.claude/CLAUDE.md` | inherits the same list by reference | Conventions |

The *substance* of the hard rule — never collapse, never derive `needs_review` from
`value === null` — is unaffected and is enforced harder now than it was with two members. Only
the **count and the names** are stale.

---

## 1. The two taxonomies, side by side

The design's card (`reference-app.html` @214135, verbatim titles and glosses):

| # | Design state | Design gloss |
|---|---|---|
| 1 | Structurally Absent | "The legal field or clause does not exist for this specific instrument or jurisdiction (e.g. Georgia security deeds do not have a trustee line; Missouri deeds do)." |
| 2 | Not Found in Search Package | "Expected in the search scope but **physically missing from the uploaded county records bundle** (e.g. 2023 county tax statement omitted)." |
| 3 | Not Stated in Instrument | "The instrument is present in the scan, but the drafter left the specific field, consideration, or legal description blank." |
| 4 | Page Unreadable / Scan Degraded | "The document page scan is below readable optical contrast floor (e.g. p29 UCC filing). The report must explicitly name which pages were unreadable." |

The contract (`packages/contract/src/enums.ts:19-59`):

| Member | Rulebook gloss | Surfaced for review |
|---|---|---|
| `NOT_PRESENT` | "structurally absent in this jurisdiction … Correct, and NEVER surfaced for review." | no |
| `NOT_FOUND` | "the field exists in this jurisdiction and was searched for, and **there is nothing of record**." | yes |
| `NOT_STATED` | "the document is silent on it. Distinct from `NOT_FOUND`: the search happened and returned a document; the document does not say." | yes |
| `PRESENT_UNREADABLE` | "it is on the page and could not be read … the only member that carries a page reference." | yes |
| *(no member)* | a null `value` with a null `na_reason` = **NOT YET EXTRACTED**, "a fifth, distinct render … a statement about the PIPELINE, not the document." | no |

## 2. The mapping

| Design state | Contract member | Verdict |
|---|---|---|
| 1. Structurally Absent | `NOT_PRESENT` | **Clean match.** Same concept, same jurisdiction framing, same example shape. |
| 3. Not Stated in Instrument | `NOT_STATED` | **Clean match.** |
| 4. Page Unreadable / Scan Degraded | `PRESENT_UNREADABLE` | **Clean match**, and the design adds a *reporting* requirement ("must explicitly name which pages were unreadable") that the contract already supports — `PRESENT_UNREADABLE` is the only member carrying a page reference. |
| 2. Not Found in Search Package | `NOT_FOUND` — **approximately** | **The one real divergence. See §3.** |
| *nothing* | *not-extracted* (the fifth render) | **The design has no equivalent.** See §4. |

So the brief's fear — that the design "splits a state our pipeline does not split" — is not what
happened. Design (1) is `NOT_PRESENT` and design (2) is `NOT_FOUND`; they are two different
contract members, not two halves of one. The four-to-four alignment is close to exact.

## 3. The divergence, stated precisely — design (2) vs `NOT_FOUND`

They answer **different questions**:

- The contract's `NOT_FOUND` is a statement about **the record**: the search ran and the county
  has nothing. Its examples are "McIntosh CONS, Mecklenburg PLAINTIFF ATTORNEY" — fields that
  legitimately have no value of record.
- The design's (2) is a statement about **the package**: the thing is expected in scope and is
  *physically missing from the uploaded bundle* — "2023 county tax statement omitted".

Those are not the same event and they do not route the same way. "The county has no plaintiff
attorney of record" is a finished answer a reviewer confirms. "The 2023 tax statement is not in
the bundle we were sent" is an **incomplete package** — a gap that wants a re-pull or a client
conversation, not a confirmation. Collapsing them puts a procurement failure into a review
queue as though it were a finding.

**This is the owner's call, and it is the only open question here.** Three options:

1. **`NOT_FOUND` covers both.** Simplest; loses the distinction between "nothing of record" and
   "we were not sent it".
2. **The missing-document case is not an NA state at all** — it belongs to the completeness /
   gap surface (`OrderCompletenessResponse`, `entities/gap/`), which already exists and already
   models "expected in scope, absent from the package". This is the reading this agent finds
   most likely correct, and it would mean the design's (2) is *misfiled* rather than missing.
3. **A fifth member.** Costly: it re-opens Q1 three weeks after ratification, and `enums.ts`
   already carries a fifth-member sub-question (Q1a, `__DONT_KNOW__`) that is still open.

**No option was chosen and no code assumes one.** `NA_GUIDE.NOT_FOUND` in
`apps/web/src/features/overlays/naGuideRows.ts` paraphrases the *contract's* gloss — "searched
for, and there is nothing of record" — and does not repeat the design's "missing from the
bundle" language, precisely so the overlay is not quietly asserting option 1.

## 4. The design is missing a state we have

`enums.ts:44-47` is emphatic that a null `value` with a null `na_reason` is a fifth, distinct
render — "a statement about the PIPELINE, not the document. Never collapse it into an NA state,
and never key anything off `value === null`." The design's matrix has no row for it.

The overlay therefore draws **five rows, not four**, with the fifth under its own heading, "Not
an NA state". Drawing four would have taught the reader to collapse the one the rulebook names
hardest. This is a deviation from the design's geometry, taken deliberately.

## 5. What was built, and what was refused

- The guide renders `apps/web/src/entities/field/noValueStates.ts` — the same table every field
  on every screen already draws from — so the chip, the sentence, the mark and the
  surfaced-for-review answer in the guide are the *identical values* a reviewer meets in the
  workstation. No second copy of the taxonomy exists.
- Every row prints its `enums.ts` citation on screen (principle 6: never emit a value you
  cannot cite).
- **Refused:** the title "4-State NA Taxonomy Matrix" (the count is wrong for us, and "Matrix"
  describes a grid the card does not draw) and the eyebrow "TitleFlow Product Law 3" (no such
  numbering exists in this repo's rulebook). The overlay is titled "No-value states".
- **Not invented:** no new enum members, no split of `NOT_PRESENT`, and no edit to
  `enums.ts`, `CLAUDE.md` or `INVARIANTS.md`.

## 6. What an owner is being asked for

1. Confirm §3 — where does "expected in scope, physically absent from the uploaded bundle" go:
   `NOT_FOUND`, the completeness/gap surface, or a fifth member?
2. Direct someone to correct the two stale "two NA states" lines in §0. The rule survives; the
   count does not.
