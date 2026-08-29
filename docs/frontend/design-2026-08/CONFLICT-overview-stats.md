# `CONFLICT` — the Overview's four stat cards vs the frozen contract

**Status: UNRESOLVED. Needs an owner ruling (or a backend member).**
**Raised:** 2026-08-28, while rebuilding `/` against the running prototype.
**Governing procedure:** `docs/INVARIANTS.md:26-27` —

> If a rule cannot be satisfied by a proposed design, that is a **`CONFLICT` in the design**,
> not a stale requirement. **Stop and report it. Do not weaken the rule to fit the screen.**

Nothing was weakened. `docs/INVARIANTS.md` was not edited, `packages/contract` was not
touched, and no number on the screen is computed in the browser.

---

## 1. What the prototype draws

`reference-app.html`, the `isQueue` block. Four cards, `grid-cols-4`, gap 16, `mt 24`.
Each is `label 11px w600 #8A8E98` / `value 28px w700` / `note 13px`. Verbatim from the
`queueStats` array:

| # | Label | Value | Note |
|---|---|---|---|
| 1 | Total Active Queue | `ALL_ORDERS.filter(o => o.stage !== "Delivered").length` | Open work, sorted by deadline |
| 2 | In Examination Review | `…filter(o => o.stage === "Review").length` | Dual-engine values ready for human call |
| 3 | Open Queries & Gaps | `…filter(o => o.stage === "Query" \|\| o.stage === "Gaps").length` | Awaiting QC or county portal records |
| 4 | Delivered This Week | `…filter(o => o.stage === "Delivered").length` | Signed and sealed by an examiner |

All four are **client-side filters over a 35-row in-memory array**, which is the prototype's
whole data model and is why its numbers cannot be adopted along with its labels.

## 2. What the contract serves

`LifecycleResponse` (`packages/contract/src/intake.ts:246`) is the only census this screen may
read. It carries **four top-level integers** and **one sentence**:

```
scope_note: string          total: int
halted: int                 moving: int         failed: int
stages: LifecycleStage[]    // id, label, sub, waiting_on, kind, count, orders
```

Every one of the four is decided on the server. `LifecycleStage.count` is likewise
server-supplied and explicitly **not** `orders.length` (`intake.ts:216-221`): the order list is
scoped to what the caller may see, the census is not, and "a stage count that shrank with your
permissions would read as work disappearing rather than as work you cannot look at."

## 3. Where the two taxonomies meet — one card out of four

| Prototype card | What it counts | Nearest contract figure | Verdict |
|---|---|---|---|
| Total Active Queue | everything not delivered | `total` counts everything **including** delivered | ✗ needs `total − delivered` |
| In Examination Review | one stage | `stages[id="review"].count` | ~ exact figure, see §4 |
| Open Queries & Gaps | two stages | `gate.count + escalated.count` | ✗ arithmetic over two censuses |
| Delivered This Week | one stage, **windowed** | `stages[id="delivered"].count` is **all-time** | ✗ no window in the contract |

Three of the four need a number the server does not state, and the fourth needs the client to
pick a named stage out of the census array (§4).

**Why the missing three cannot simply be computed here.** INVARIANT 5: "The UI never re-derives
counts, chain termination, or release resolution." `endpoints.ts:143-150` records why that rule
exists — these figures "were being computed in the browser from the `fields` array", which it
calls "the browser ruling on provenance", and notes that "a count whose definition lives in a
component is a count nobody can audit against the pipeline."

**Why the labels cannot be pasted over the figures we do have.** This is the same defect
`CONFLICT-all-orders.md` §4 already ruled on, from the hub's meter:

> A meter measuring one thing under a caption naming another is the defect; a meter measuring
> what it says is not.

"Delivered This Week" over an all-time count is precisely that. So is "Total Active Queue" over
a total that includes delivered orders.

## 4. Why even card 2 was not built as named

`stages[id="review"].count` **is** the right figure and needs no arithmetic. What it needs is
for the client to hardcode the string `"review"` and pick that member out of the array.

`LifecycleStage.id` is `z.string()`. The contract nowhere enumerates the stage ids, and it
declines to enumerate the neighbouring vocabulary on purpose: `LifecycleStamp.label` is
"a FREE STRING, not an enum, and that is deliberate. An enum is an invitation to `switch` on it,
and a `switch` on a lifecycle word is the same state machine moved one line down"
(`intake.ts:264-272`). A headline card that silently vanishes when the shop renames a stage is
the same fragility wearing a lookup's clothes.

So the census array is rendered **whole**, by the lifecycle board at `/dashboard`, which is what
it is shaped for — and the Overview links to it rather than cherry-picking four of its seven
rows into a headline.

## 5. What was built instead

Four cards in the prototype's exact geometry, over the four figures the server **does** state,
labelled as those figures and nothing more:

| Label | Source | Tone |
|---|---|---|
| Total in the shop | `LifecycleResponse.total` | ink |
| Halted | `LifecycleResponse.halted` | attend |
| Moving | `LifecycleResponse.moving` | graphite |
| Failed | `LifecycleResponse.failed` | halt |

**There is no note line, and that is the finding, not an omission.** The prototype's third line
is authored copy written against *its* four figures. The contract authors no note for these
four — it carries the integers and `scope_note`, which the screen prints verbatim in the
subhead. The previous version of this screen composed four sentences to fill the slot ("Every
order the book knows about", "The machine is working on these"), which is what the owner caught.
AGENTS.md's "never emit a value you can't cite" is not only about numbers: a sentence asserting
what a figure means is a claim about the pipeline, and the pipeline did not make it.

A card one line shorter than the prototype's is the honest render. The row reads lighter than
the design does, and that is the visible shape of the gap.

## 6. The options, for the owner

**Option A — Add the members. Draw the prototype's four cards.** (Recommended.)
`LifecycleResponse` gains three figures and a per-figure note:

- `active: int` — orders not delivered. One server-side definition instead of a browser
  subtraction.
- `queries_and_gaps: int` — or whatever the shop's real name for that bucket is; the prototype's
  is `Query + Gaps` and ours is `gate + escalated`, and only the shop can say whether those are
  the same category.
- `delivered_recent: int` **plus the window it covers as a label** — "this week" is a period the
  server must define, and printing a window the client chose would be the same caption defect
  one layer down.
- `note: string` per figure, for the same reason `QueueBand.note` and `LifecycleStage.sub`
  already exist: "a client-side `Record<…, string>` is a second copy of product copy that drifts
  silently from the first" (`endpoints.ts:96-98`).

**Cost:** a backend conversation and four members. **Risk:** `delivered_recent` is the only one
that needs care — a windowed count is one short step from a rate, and §4.5 means the rate never
may exist. It must be a count of what was delivered, never a pace.

**Option B — Keep what is built. Amend the design bundle.** The prototype's four names are
retired and the design bundle records the contract's four instead. **Cost:** none in code.
**Risk:** the note line stays empty forever, so the card row keeps reading lighter than the
design, and the next agent to open the prototype re-raises this file.

**Option C — Rule that the client may name stages.** If `LifecycleStage.id` is a stable
contract value rather than an incidental one, say so in `intake.ts` and card 2 can bind to
`stages[id="review"].count` today. This is narrow and cheap, and it closes exactly one of the
four. **Note:** it does not need the ids to become an enum — it needs the contract to state that
they are stable, which is a different promise.

## 7. What must not happen

- **Do not compute the missing three in the browser.** INVARIANT 5, and `endpoints.ts:143-150`
  gives the reason in the pipeline's own words.
- **Do not read `/api/metrics` for a stat card.** It carries `median_minutes_per_order`, a pace
  indicator. `INVARIANTS:84-85` bans them and AGENTS.md bans throughput counters "anywhere".
- **Do not read `/api/queue/bands` for a stat card.** Its four bands carry a server-authored
  `title`, `note` and `count` — the stat card's exact shape, which is what makes it tempting.
  It is ⚠ AWAITING RATIFICATION and whether its Mine band may be **drawn at all** is open ruling
  Q11 (`endpoints.ts:99-102`). AGENTS.md: do not build past `OPEN`.
- **Do not restore a note line by authoring one here.** That is the defect this file exists to
  record.
