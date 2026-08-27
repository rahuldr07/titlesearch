# `CONFLICT` — design screen 3 "All Orders" vs the frozen contract

**Status: UNRESOLVED. Needs an owner ruling.**
**Raised:** 2026-08-27, while building the `/queue` screen.
**Governing procedure:** `docs/INVARIANTS.md:26-27` —

> If a rule cannot be satisfied by a proposed design, that is a **`CONFLICT` in the design**,
> not a stale requirement. **Stop and report it. Do not weaken the rule to fit the screen.**

This document is that report. Nothing was weakened, no browse route was created, and
`docs/INVARIANTS.md` was not edited. `ANALYSIS-screens.md` §6 raised the same collision from
the analysis side; this restates it from the *build* side, with the four options an owner
actually has to choose between.

> **Prior art, and why this file repeats itself.** An earlier agent "resolved" this by editing
> `docs/INVARIANTS.md` to mark rules 22 and 23 superseded. That was reverted **twice**. The
> rules are not stale and the edit is forbidden. If the reasoning below is unpersuasive, the
> answer is a ruling recorded here, not a diff there.

---

## 1. What screen 3 asks for

`docs/frontend/design-2026-08/README.md:20`, verbatim:

> **3. All Orders** — search (field:value syntax + suggestions), filter tabs in 10px/4px/6px
> segmented control, table: Ref (mono grey) / Address (16px w600) / Client / Stage / Assigned /
> Due (right, mono). One signal per row. Pagination 10/page. Empty state with Clear search. Row
> actions: audit-history modal, Open →.

And `README.md:14`, the order bar that rides above every screen:

> shows ref (mono, 18px), address, product pill, **SLA chip**, primary action button, and 5 stage tabs

Two more screens lean on the same absent surface:

- `README.md:19` (screen 2, Overview): *"Recent orders table (last 10) linking to All Orders."*
- `README.md:30` (§Interactions): *"`/` focuses search"* — the search being screen 3's.

## 2. What it collides with

**`docs/INVARIANTS.md:82-83`** (rule 22):

> The queue is a **single server-chosen next order** — no list, no browsing, **no cherry-picking**.

**`docs/INVARIANTS.md:84-85`** (rule 23):

> **No pace indicators, no throughput language, no timers, and no time ESTIMATES** — an estimate
> is a pace indicator.

**`packages/contract/src/endpoints.ts:69`:**

> `/** GET /api/queue/next — server-ordered; there is no browse/pick endpoint. */`

**`packages/contract/src/endpoints.ts:77-82`:**

> `GET /api/queue/bands` — READ SHAPES ONLY, and deliberately NOT a browse endpoint. None of
> these rows carries a way to TAKE the work: there is no claim token, no assignment field, no
> ordering the caller can influence. `/api/queue/next` remains the only hand-over, so §4.4's
> "no queue cherry-picking" holds **by construction rather than by the screen's restraint.**

## 3. Why it is irreconcilable, affordance by affordance

The table is not one refused thing. It is six, and they fail for four different reasons.

| Affordance | What it needs | Why it cannot be built |
|---|---|---|
| The row list | An endpoint returning many orders | None exists. `endpoints.ts:69` says so in words. |
| Search (`field:value`) | Caller-influenced filtering | `INVARIANTS:82` — browsing. Also no endpoint takes a query. |
| Filter tabs | Caller-influenced scoping | Same. |
| Pagination 10/page | An offset the caller controls | Same, plus it is client-side slicing of a server census (`ANALYSIS-screens.md` §5 item 8). |
| `Open →` per row | A way to TAKE a specific order | `INVARIANTS:82` — **cherry-picking**, the named refusal. |
| `Assigned` column | An assignment field on the order | `Order` (`entities.ts:32-63`) is the exhaustive shape and has none. `QueueBandOrder` deliberately has none (`endpoints.ts:79-81`). |
| `Due` column | A due date | **`INVARIANTS:84-85`.** No such field anywhere in the contract. |
| SLA chip | An SLA target and elapsed time | Same. An SLA chip is a countdown, which is a timer. |

**The critical point about `/api/queue/bands`.** It is tempting to read it as the browse
endpoint in disguise: it returns `orders: QueueBandOrder[]`, and one could paint a table from
those rows. That reading is wrong, and the contract pre-empts it. `QueueBandOrder`
(`endpoints.ts:108-121`) carries **no claim token, no assignment field, and no ordering the
caller can influence** — the shape was designed so that even a screen that *drew* the rows
could not offer a way to take one. `endpoints.ts:80-82`: the no-cherry-picking rule holds "by
construction rather than by the screen's restraint."

So `bands` does not resolve the conflict. Painting screen 3 from it produces a table whose
`Open →` cannot be wired, whose `Assigned` column has no data, and whose `Due` column is
banned — which is to say, screen 3 minus everything that makes it screen 3.

**And it is not ratified.** `QueueBandsResponse` is marked ⚠ **UI-DRIVEN REQUEST — AWAITING
RATIFICATION** (2026-07-30, fidelity Wave 2), and whether the Mine band may be **drawn at all**
is **open ruling Q11** (`endpoints.ts:99-102`), which "sits against *exactly one order, no
list*." Root `AGENTS.md`: **do not build past `OPEN`.**

## 4. A second, smaller gap this build hit

Not a conflict — a missing figure, recorded here so it is not lost.

Design §Screens 4 draws the hub's meter as **"N of M decisions settled"**. `OrderCensus`
(`endpoints.ts:139-160`) carries four figures — `fields`, `auto_confirmed`, `needs_review`,
`no_source` — and **not a settled count**. Deriving one (`fields - needs_review`) is exactly
the browser arithmetic the shape was written to remove: `endpoints.ts:143-150` records that
these figures "were being computed in the browser from the `fields` array", calls it "the
browser ruling on provenance", and notes that "a count whose definition lives in a component is
a count nobody can audit against the pipeline."

**Built instead:** the meter draws the pair the server *does* state (`auto_confirmed` of
`fields`) and is **labelled as that**, and the card says in words that "decisions settled" is
not a figure the contract serves. A meter measuring one thing under a caption naming another is
the defect; a meter measuring what it says is not.

**Ask for the backend owner:** should `OrderCensus` gain a `settled` (or `decided`) member? It
is the one number the design's headline needs and the only one it cannot have.

## 5. What was built at `/queue` instead

The queue **the contract supports**, in the design's visual language:

- `GET /api/queue/next` — **exactly one served order**, no list, and the second queued order
  appears nowhere on the page.
- `null` renders as *"the server has nothing for this seat"* — an **answer**, not an empty
  filter result. There is no "Clear search", because there was never a search.
- A **reasoned pass**: refused without its reason with a visible nudge (`INVARIANTS:52`, `:55`,
  `:56`), Escape keeps the order, and a recorded pass **re-asks the server** for the next one
  (`INVARIANTS:87`) rather than stepping a local cursor.
- **Enter starts review on the served order** (`INVARIANTS:88`), and the keys are pane-local:
  Enter on a rail door follows the door, Enter on the pass button opens the reason.
- The design's type scale, spacing, card treatment and single accent spend (rule 1).
- **No** search, filter tabs, pagination, `Assigned`, `Due`, SLA chip, or per-row `Open →`.

The screen states its own shape on the page — *"The server chooses. There is one order at a
time and no way to pick a different one"* — so a reviewer expecting the design's table is told
that is the design, rather than left assuming the list failed to load.

## 6. The options, for the owner

Exactly one of these has to be chosen. They are not equivalent and three of them are cheap.

**Option A — Keep the rules. Drop screen 3.** (Recommended, and what is built today.)
The queue stays the served single order. Screen 3 is deleted from the design bundle rather than
left as an unbuilt screen somebody re-raises every quarter. The Overview's "recent orders" and
the `/` search key go with it. **Cost:** none in code; the design bundle loses a screen. **Risk:**
a reviewer who wants to look up an order they remember has no way to, which is the thing the
rules deliberately prevent.

**Option B — Keep the rules, add a NARROW LOOKUP.** A reviewer can *reach* a specific order by
reference — `GET /api/orders/by-ref/{ref}` — but cannot **list**, cannot **filter**, and cannot
**take**. This is the smallest change that answers the real need ("a client rang about
4176034-1") without becoming a work-selection surface. It needs a backend conversation and a
new door. **Note:** it must return one order or 404, never a partial-match list, or it is a
search with one result.

**Option C — Rule that browsing is legitimate for SOME roles.** An ops/senior read of the shop
is arguably a different act from a reviewer picking their own work. If so, the rule needs
rewriting to say **who** it binds and the contract needs a genuine browse endpoint. This is the
expensive option: it reopens rule 22, touches `PERMISSIONS`, and needs the answer to Q11 first.
**It is the only option that may edit `INVARIANTS.md`, and only after the ruling is recorded.**

**Option D — Ratify `/api/queue/bands` and draw the bands, read-only.** No `Open →`, no
`Assigned`, no `Due`, no search. The reader sees *what is in the shop* and still takes work only
from `next`. This is a partial answer to the same need as B and needs **Q11 settled first**
(`endpoints.ts:99-102`), because Q11 asks whether the Mine band may be drawn at all.

## 7. What must not happen

- **Do not edit `docs/INVARIANTS.md`** to mark rules 22 or 23 superseded. Reverted twice
  already; `INVARIANTS:26-27` names this as the wrong move by construction.
- **Do not build the table against `/api/queue/bands`** as a workaround. §3 explains why the
  shape refuses it, and doing so past Q11 is building past `OPEN`.
- **Do not add a `Due` column or an SLA chip anywhere**, including the order bar. There is no
  field to bind them to, and inventing one is the UI generating backend surface (hard rule 1).
- **Do not add client-side pagination** over any server census. `endpoints.ts:152-156`: a total
  that shrank with your permissions reads as work vanishing.
