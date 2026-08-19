# Design fidelity — apps/web-v2 against the 2026-07-28 export

**Written 2026-07-30.** Evidence: `docs/frontend/fidelity-audit-2026-07-30.md`
(18 screens, 221 divergences, 70 code findings, 23 reuse proposals).

## Goal

Bring `apps/web-v2` into faithful agreement with the approved export — the layout,
the copy, the proportions, the states — and land the reuse discipline HANDOFF-UI §1
asks for, without violating a single product rule from §4.

Not a rebuild. The token layer, the refusal semantics and the `CONTRACT GAP` culture
are correct and stay. What changes is the frame every screen sits in, the primitives
they compose from, and the data they compose over.

## The three root causes

Ninety percent of the 221 divergences reduce to these.

**1. There is no full-height pane architecture.** The export roots at
`height:100vh; overflow:hidden` and repeats `height:100%; overflow:auto` on every
screen body. `apps/web-v2/src/app/rootRoute.tsx:47` roots at `min-h-screen` and
page-scrolls. A grep for `overflow-y-auto|min-h-0|h-dvh` across `src/` returns one hit
outside `Card`.

**2. `mx-auto` on a `flex-1` flex item cancels `align-self:stretch`.**
`rootRoute.tsx:51` is `<main className="mx-auto min-w-0 max-w-720 flex-1 p-9">` inside
a flex column, so `main` sizes shrink-to-fit. Queue asks for 860px and renders 670px.
Profile, which sets no measure at all, collapses to its content's natural 421px where
the export draws a 720px column — so the bug punishes both the screens that specify a
measure and the ones that do not. No viewport-width guard catches this: the container
is the binding constraint (HANDOFF-UI §6). `max-w-720` is also 1440px on the 2px base,
not 720px.

**3. The kit was built and then bypassed.** Fourteen components have zero production
call sites while `features/review/` reimplements them, and the duplicates are the ones
that drifted: the dead `entities/field/DecisionBar` carries the export's exact button
copy, the live `features/review/DecisionActions` does not. `knip` misses this because
`.stories.tsx` counts as usage.

## Decisions taken

Four were ruled by the owner on 2026-07-30:

| | Ruling |
|---|---|
| Scope | All five waves. |
| Fixtures | Fatten from ONE shared order set; contract additions permitted. |
| Reader A/B | Collapse to the export's single `AS READ` row; attribution behind a disclosure. |
| Contract | Add the read-only shapes now, each noting it is a UI-driven request awaiting ratification. |

The rest are taken here, with reasons, so they can be objected to rather than
discovered:

- **The order still comes from the URL.** No global "current order" — two tabs on two
  orders is a normal way to work. The export's strip is always populated only because
  the export carries one global demo order. With `order_ref` added to an order-scoped
  response the strip gains a real reference on order screens; off them it stays
  brand-neutral. Separately, the rail must stop printing `THIS ORDER` over five
  numbered stages when there is no order to name.
- **Door glyphs become label initials; the chord moves to the row `title` and the `?`
  map.** A chord is learned where it is printed, not from a square. `Door.key` stays
  the single chord source and `Door.icon` stops aliasing it. Nothing in the suite
  asserts the square's letter (`roles.spec` asserts `label`, `navigation.spec` the
  chord).
- **The `/escalations` rail door stays**, though the export does not draw it: it is
  the only live carrier of two release-blocking invariants — attention rides the doors
  as *dots, never counts*, and an unheld door is *absent, not dimmed*
  (`sidebar.spec.ts:43,:65`). Recorded in `conflicts.md` as a deliberate departure.
- **`Pass — say why` stays; the export is stale.** Pass-with-reason is real
  server-side behaviour with a `min(1)` refusal and fourth-pass auto-escalation. The
  on-screen `Keys: ⏎ take it · P pass` hint goes (the export puts key hints nowhere on
  a screen; the `?` map is where they live), and so does `Report pipeline bug`, which
  has no product rule behind it. Both recorded in `conflicts.md`.
- **Ingest keeps two acts** (`ingest.spec` #2) and borrows the export's copy: press
  one is `Upload the package`, press two is `Continue to sign-off →`, so the export's
  wording lands on the press that advances the step.
- **The Overview board raises its rail threshold to ~1190px** rather than adopting the
  export's `overflow-x:auto`. Squeezing beat scrolling because the export's 1190px
  minimum inside a 764px container hid two whole stages behind a scrollbar with no
  affordance (HANDOFF-UI §6). The board is now only ever drawn at its intended width.
- **Where the export's markup and its render disagree, the render governs.** This
  decides the stage-owner column: the markup carries filled owner pills, the render
  shows plain uppercase. "Make it look the same" means the rendered artefact. The
  false WHY note at `StageRow.tsx:75-83` gets corrected either way — it asserts the
  design sets all three owners identically, which is true of the render and false of
  the markup.
- **The strip adopts the export on all three count behaviours**: hidden below 1180px,
  `NO SOURCE` stays muted rather than turning red, numerals in 15px mono. Red on
  `NO SOURCE` makes it louder than `NEED YOU`, which is the actionable tile. The
  "always visible, never breakpoint-hidden" comment at `OrderCounts.tsx:54` is then
  deleted — a comment asserting an untrue invariant is worse than no comment.
- **A done stage may not carry an open badge.** `LifecycleStage`'s two halves are each
  correctly server-cited; the fixture contradicting itself is the bug, and the rule is
  recorded so the next fixture cannot reintroduce it.
- **The two `LOCAL PREVIEW` toggles are defects, not divergences.** They let a user
  repaint a server verdict, producing screens that state the opposite of what they
  show. Both renderings move to `features/gallery`, which this build already keeps for
  states no fixture can reach.

## Architecture

### `AppShell` + `Pane` — the frame (fixes causes 1 and 2)

One primitive set, nine call sites, both layout blockers.

```
AppShell     h-screen overflow-hidden, the flex row: sidebar | content column
Pane         flex flex-col min-h-0            — a bounded region
PaneHeader   flex-none                        — never scrolls
PaneBody     flex-1 min-h-0 overflow-y-auto   — the scroller
PaneFooter   flex-none                        — docked (coverage spine, decision bar)
```

`min-h-0` on the body is the class that gets forgotten and the reason a nested flex
scroller grows instead of scrolling. Putting it in one component is the point.

`rootRoute`'s `main` becomes full-width; the measure moves to an inner centred
wrapper, which is what cause 2 requires.

### `Screen` — the per-screen measure and placement

The export gives each screen its own measure and padding — every value below was read
off the markup, not inferred from a screenshot. `placement` is `top` (horizontally
centred, top-aligned — whether the export spells it `margin:0 auto` or
`justify-content:center` + `align-items:flex-start`) or `centre` (centred on both
axes). Widths are px; `Screen` expresses them on the 2px base.

| Screen | Measure | Padding | Placement | App today |
|---|---|---|---|---|
| Review | — | — | `bleed` | — |
| Overview | 1340 | 26×30 | top | **none** |
| Rulebook | 1160 | 24×28 | top | **none** |
| Gallery | 1120 | 28×32 | top | `max-w-560` ✓ |
| Products | 1040 | 28×32 | top | **none** |
| Audit | 940 | 28×32 | top | **none** |
| People | 900 | 28×32 | top | **none** |
| Clients | 880 | 28×32 | top | **none** |
| Queue | 860 | 28×32 | top | `max-w-430` ✓ |
| Completeness | 720 | 32×40 | top | `max-w-360` ✓ |
| Profile | 720 | 28×32 | top | **none** |
| Escalation | 700 | 28×32 | top | **none** (`max-w-3xl`, see below) |
| Processing | 700 | 40 | centre | `max-w-350` ✓ |
| Questions | 640 | 36×40 | top | `max-w-320` ✓ |
| Upload | 560 | 40 | centre | `max-w-280` ✓ |
| Delivered | 460 | 40 | centre | `max-w-230` ✓ |
| Surface failure | 440 | 40 | centre | `max-w-220` ✓ |
| Session | 420 | 40 | centre | `max-w-210` ✓ |
| Signin | 380 | 40 | centre | `max-w-190` ✓ |

**Ten of the eighteen already carry the exact export measure.** The measures are not
wrong; they are unfinished and un-deduplicated. Seven screens have none and inherit
the shell's 1440px — which is why Rulebook stretches where the export holds a column.
The eighth, Escalation, uses `max-w-3xl`: a Tailwind *default* scale value (768px)
mixed into an app whose spacing base is 2px, so it is neither the export's 700px nor
expressible in the app's own scale.

Padding is the divergence that hits all eighteen: the shell's `p-9` is **18px** on the
2px base against the export's 28–40px, so every screen is roughly half as padded as
drawn.

`Screen` collapses eleven hand-rolled wrappers — seven `mx-auto max-w-N flex-col` and
four byte-identical copies of `flex min-h-full items-center justify-center py-20` —
along with the seven prose comments that each independently re-derive the same rule.
It also owns the `PaneBody` scroller, so adopting it is what fixes causes 1 and 2.

### `chromeless(pathname)`

One predicate, two call sites, one blocking bug. `/signin` and `/session` draw no
chrome at all (the export gates on `showChrome = !(isSignin||isSession)`). `/blind/*`
additionally suppresses the preference and attention fetches — the zero-GET rule —
so the predicate distinguishes *no chrome* from *no chrome and no requests*.

## The component set

Twenty-three proposals, ranked by call sites collapsed. Waves 1 and 3 build them;
Wave 4 assembles screens from them. Full list with per-site evidence in the audit
record; the load-bearing tier:

| Component | Renders | Sites |
|---|---|---|
| `Card` **tone axis** (absorbs `ToneNote`) | the tinted semantic block: `--X-tint` ground, `--X-edge` hairline | 27 |
| `ScreenHeading` (absorbs `ScreenTitle`) | eyebrow + h1 + lede as one unit at one measure | 15 |
| `ListRow` + `DividedSection` | `border-t border-line-subtle first:border-t-0` | 15 |
| `RefusalNudge` (from the unused `RequiredComment`) | the alert naming what is missing, `aria-describedby` wired | 11 |
| `PanelCard` | `Card` + captioned/banded heading + gap'd body | 11 |
| `Pane` + `AppShell` | above | 9 |
| adopt-or-delete the dead kit | — | 23 |
| `CensusTile` | mono numeral + stat eyebrow | 5 |
| `ReasonEditor` | inline refusal editor, Enter commits / Esc cancels | 5 |
| `EmptyPanel` + `EmptyNote` | *resolved and empty*, never *not loaded* | 6 |
| `CenteredScreen` | verbatim-identical wrapper, 4 sites | 4 |

`RefusalNudge` is the highest-stakes item on the list: three of its eleven current
sites omit the `aria-describedby` link, so HANDOFF-UI §4.6 — a release blocker — is
accessible on some screens and not others.

Two axis corrections inside existing primitives, each unblocking several screens:

- **`Card.accent` draws the wrong axis.** It is a 4px *left* border; `grep -c
  'border-left:4px'` on the export returns **zero** against five inset-*top* stripes.
  Six call sites are wrong. It becomes a 2px inset top stripe and gains a `settled`
  case.
- **`ToggleGroup` needs a `segmented` variant** (bordered track, pressed =
  `bg-surface-panel text-action-ink`) while keeping the fill-swap the sixteen
  filter-chip instances use. It is otherwise the one pattern this build reused
  perfectly, with no per-screen forks.

`CensusTile` is named *census*, not *stat*, on purpose: §4.5 forbids rates, and the
name is what makes a future `perHour` prop obviously refusable.

## Blocking items

Six, deduplicated to the thing that owns each.

| | Item | Owner |
|---|---|---|
| B1 | no fixed-height frame | `rootRoute.tsx:47` + `Pane` |
| B2 | `mx-auto` cancels stretch; every screen narrower than drawn | `rootRoute.tsx:51` |
| B3 | full sidebar + ADMIN identity chip drawn to an unauthenticated viewer | `AppChrome.tsx:63`, `OrderStrip.tsx:52` |
| B4 | Review prints all 15 settled values twice, ~900px apart, with the 6 live decisions sandwiched between | `features/review/FieldList.tsx:63-73` (delete) |
| B5 | Upload is the wrong screen — five bare text inputs where the export has a file receipt, a client card grid, a six-card product grid and a forward link | `features/ingest/IngestScreen.tsx:104-141` |
| B6 | the client picker is free text, and the `CONTRACT GAP` note justifying it is factually wrong — `GET /api/clients` already serves `{id,code,name}` | `features/ingest/orderFields.ts:4` |

B6 matters beyond fidelity: a mistyped client id resolves the wrong sign-off list,
which is the one thing intake decides.

## Fixtures and contract

One shared demo order set in `packages/mocks/src/data.ts` that `queue/next`, the queue
bands, `/api/lifecycle`, completeness and delivered all read. Two hand-maintained
copies is the drift the export's own comment warns about, and it currently produces a
lifecycle board that contradicts `/api/queue/next` about DEMO-0001.

Anchors: the export's five orders, **64 pages**, product **40-Year Search**, period
`40-year period · 07/18/1986 – 07/18/2026`, and the product's canonical thirteen
sign-off lines (six YES/NO-only, comment-required on ten). Every derived string quotes
the page count rather than carrying its own number.

Contract additions are **read shapes only** — no writes, no state machines, nothing
that lets the UI decide a transition. Each carries a note recording that it is a
UI-driven request awaiting ratification, per root `CLAUDE.md`. The set: an
order-scoped `order_ref`; a server-owned lifecycle stamp label; `nav_collapsed`
nullability (a plain boolean cannot express "never touched", which is why
starts-collapsed-on-Review is unreachable today); queue band read shapes with
per-band `count`; `Order.product/period/pages`; `LifecycleStage.sub` + `waiting_on`;
`LifecycleOrder.id/mine/state`; `OrderSignoffLine.answers` +
`policy_suggestion: SignoffAnswer.nullable()` (a boolean today, so the screen
genuinely cannot name the value); `CompletenessGap.line_number`; `close_options` as
`{kind,label,consequence,requires_comment,min_role}` rather than `string[]`;
`Field.asking` + `why`.

## Sequencing

**Wave 0 — the shell.** Serial, blocks the most, one agent. `AppShell`/`Pane`/`Screen`
→ root becomes `h-screen overflow-hidden`, `main` full-width with an inner centred
wrapper (B1 and B2 together), `chromeless()` (B3), hide the collapse toggle while
forced. Also gates: teach `knip` to stop counting `.stories.tsx` as usage, so the next
bypassed component is caught by CI rather than by an audit; and fold the corrected
click-path selector into `compare.mjs`, which has been silently capturing the Queue
screen for every design shot it ever wrote.

**Wave 1 — primitives.** Fully parallel, independent files, no screen rework.

**Wave 2 — fixtures + contract.** Parallel with Wave 1, different packages, zero file
overlap. The shared order set first, then the per-screen data.

**Wave 3 — entities.** After Wave 1. `RailRow` + the single six-entry flow definition
start immediately (six rail fixes ride on that duplicated block, and `AppChrome:28-34`
and `doors.ts:50-54` currently disagree about labels). The `entities/field` adoption
carries the Reader A/B collapse.

**Wave 4 — screens.** Review first and alone: it holds two blockers, consumes the most
new components, and is the screen whose rework exposes anything the primitives got
wrong. Then three parallel tracks: upload + questions · overview + queue ·
completeness + processing.

**Wave 5 — copy and density.** Last, parallel, mechanical. Restoring the export's
load-bearing sentences and every `density` finding. Pointless before the layout is
fixed — the spacings move anyway.

## Verification

Every wave runs the whole gate (HANDOFF-UI §10): `typecheck`, `check:rules`, `lint`,
`test`, `test:e2e`, `knip`, then root `pnpm typecheck`. Baseline on 2026-07-30 is all
green — 297 tests, `check:rules` clean over 283 files, zero skips — so any red is
this work.

A green suite is not evidence the UI is right. Every screen touched in Wave 4 is
re-captured against the export with the fixed `compare.mjs` and looked at.

Three rules get a test they do not have today, because each was found asserted in
prose and violated in code: `min-h-0` present on every scroller (`Pane`); a done stage
never carrying an open badge; and the forced-collapse toggle never writing a
preference the user did not choose.

## Out of scope

Q4–Q10 stay read-only. The four-member NA set stays unratified — the contract ships
two and this work does not settle it. C18's `excluded_reason` model is not revisited.
No write endpoints for the config layer. No new theme work; both themes are done and
AA-verified.
