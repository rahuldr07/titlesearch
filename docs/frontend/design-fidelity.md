# Design fidelity — web-v2 against the design of record

**Written 2026-07-28**, after finding that three screens had been built without reading the approved package.

## The two packages, and which one is authoritative

| Source | What it is |
| --- | --- |
| `design-export/TitlePipe reviewer.zip → TitlePipe.dc.html` | **The design of record.** 3,536 lines, 18 screens, one file. BRIEF §1: *"The visual design is approved and final."* `conflicts.md` cites its line numbers. `tokens.md` §1 measured the token layer from it. |
| `docs/archive/Title report review tool.zip` | The older per-screen handoff, 16 `.dc.html` files. |

They overlap on the reviewer flow and diverge on everything else.

**The design of record draws 18 screens:** `signin overview queue review escalation questions rulebook upload processing completeness delivered products clients people profile session audit gallery`.

**It does not draw the twelve measurement screens.** `open-rulings.md` records this: *"The export does not draw twelve of the sixteen old screens — the entire measurement suite… Those screens' rules are unaffected by this export."* Dashboard, bench, bench results, leaderboard, blind fifty status, blind seat, reconciliation, golden set, seed correction, complaints and delivery therefore have exactly one design — the archive — and building them from it was correct.

**Three screens were built from the wrong source or from none:**

| Screen | Built from | Should have been |
| --- | --- | --- |
| Review | harvested invariants + contract + fixtures only | `TitlePipe.dc.html` §review |
| Ingest | harvested invariants + mock handler only | `TitlePipe.dc.html` §upload |
| Escalations | archive `Escalation Inbox.dc.html` + ruling D1 | `TitlePipe.dc.html` §escalation |

The token layer is unaffected — it was measured from the right file — so the register, type scale, spacing and shadows are the approved ones throughout. What was unverified is **layout and completeness**, screen by screen.

---

## Review — reconciled 2026-07-28

The design is three panes: document viewer · decision queue · draft Call Back Sheet.

### Closed

- **The draft Call Back Sheet.** The right pane, and the reason the screen is shaped as it is: the reviewer is watching a document take shape, not filling a form. Section headings match the delivered Word document; every value cites its page; corrections and escalations are labelled as human decisions. Read-only — an editable draft is a bulk-edit surface wearing a document's clothes. Built from `/api/orders/{id}/fields`, which supplies all of it.
- **The decision-queue framing.** Answered-of-needed rather than a bare countdown, plus the design's "one at a time" line. Pending fields are in neither denominator — the pipeline has not looked at them, so they are not something a reviewer failed to answer.
- **The four NA renders on the sheet** — already faithful. `entities/field/noValueStates.ts` labels are verbatim from this design (`n/a — not used in this jurisdiction`, `Not found — searched, none of record`, `Document silent — not stated on any page`, `◑ Present — unreadable on page`).

### Open — recorded, not built

- **`✕ Not our party`** (design `:833`, `d.onNotParty`). A fourth decision, for identity fields — the judgment hit that is not against our owner. It is the screen form of rulebook R13 (*"Canceled/satisfied/vacated/released/duplicates suppress with reason"*). **CONTRACT GAP:** `FieldState` has no `excluded` member and no endpoint suppresses a field, so there is nowhere for the decision to go. The design's own state map carries it (`isExcluded`, and the sheet renders `Excluded — not our party`). Needs a contract addition; building it as a `correct` would record a suppression as a value change, which is a different claim. → **C18**
- **`{{ d.asking }}` / `{{ d.flagWord }}` / `{{ d.why }}`.** The card explains why this field is in front of you. **CONTRACT GAP:** `Field` carries `rule_refs` and `source_snippet` and nothing that says why it was queued. Inventing the sentence client-side would be deriving a product rule from pixels.
- **The document pane** — page viewer, zoom, page strip, the *"Not read in full"* state for pages the classifier skipped. `DocumentPane`, `PageStrip` and `EvidenceOverlay` all exist and are unmounted, because **no page-image endpoint exists**. `SourcePin` renders the recorded line geometry and says plainly that it is not the scan. *"Pages read in full · 11 of 64"* has no source either — `source_page` gives pages **cited**, which is a different number and must not be relabelled as this one.
- **Abstractor sign-off panel, the "abstractor said NO" disclosure cards, Finalize & deliver, Reopen → v2.** Open rulings Q13 (prefilled sign-off answers) and Q14 (post-delivery reopen flow). Not mine to settle.

### Conflict with a harvested invariant

The design shows a **single** `{{ d.currentValue }}` with `{{ d.currentLabel }}`. `review.spec` #3 requires **both engine readings, attributed** — and `ux.spec` #2 requires the differing characters between them highlighted. The invariant wins and the A/B panel stays. → **C19**

---

## Ingest — reconciled 2026-07-28

### Closed

- **The drop zone**, with the design's own copy: *"Drop the search package here / or click to browse — one PDF, one order."* The file input stays real and keyboard-reachable underneath; drag-and-drop is an addition to it, never a replacement.
- **The file chip** — name and size.
- **Step framing and the ordering copy**: *"One scanned PDF per order… Nothing leaves this tool as a deliverable until a reviewer has gone through it field by field."*

### Open — recorded, not built

- **Page count and `✓ readable` on the chip.** Findings the server produces after opening the PDF; no response shape carries them. Counting pages in the browser would be the client asserting a fact about a document it has not processed.
- **"Recently delivered · get back to a recent one" with Reopen · v2.** Q14.
- **Steps 2–4** — Questions, Processing, Completeness. Q4–Q10, no backend counterpart.

### Conflict with a harvested invariant

The design's upload step collects **only the PDF**; the five order fields appear elsewhere in its flow. `ingest.spec` #1 requires `order-external_ref`, `order-client_id`, `order-jurisdiction`, `order-state`, `order-county` on this screen, and the mock's `POST /api/orders` refuses a multipart body without them. The invariant and the server agree against the design. → **C20**

---

## Escalations — reconciled 2026-07-28

The design of record is **not an inbox**. It is a senior landing on one escalated field: *"You land on the field in question, not the top of the order. Rule on it and return, or take the order over."*

### Already settled by ruling

Its resolution flow — write a ruling, return to the reviewer, and *optionally* convert it afterwards via *"↗ Open this as a PENDING rule — prefilled"* — is **conflict C11**, and **ruling D1 overrides it**: the rule step moves inside resolution and is mandatory. That decision predates this audit and stands.

### Closed

- **Landing on the order the question came from** — each question now links to its order.

### Open — recorded, not built

- **The single-field landing itself**, `View on p{page} →`, `Escalated by {by} · {when}`. **CONTRACT GAP:** `Escalation` carries `id`, `field_path_cluster`, `order_ids`, `question`, `resolution`, `rule_id`, `resolved_by` — no field id, no asker, no timestamp, no page. The order link is as close as the data allows.
- **"Take the order over."** Q15 — no ownership-transfer concept exists in the data model.

### Why the inbox shape stands

`GET /api/escalations` returns `field_path_cluster` on every row, and the contract has no per-field escalation record. The shape the server sends is a cluster; grouping by it is what turns five people hitting one wall into one missing rule. Both designs are recorded here so the divergence is a decision, not an accident. → **C21**
