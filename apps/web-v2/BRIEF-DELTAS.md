# BRIEF deltas — where `BRIEF.md`'s premises differ from the repo

`BRIEF.md` is kept verbatim as issued. This file records every place its stated premises
do not match the actual repository, measured 2026-07-27. Each entry states the claim, the
measurement, and the consequence. Nothing here is a decision — decisions land in
`docs/frontend/decisions.md`.

---

## D-1 — `design-export/` is not "generated React + Tailwind"

**BRIEF §2 claims:** *"`design-export/` contains a Claude Design package — generated React + Tailwind for the new screens."*

**Measured.** `design-export/` holds two files:

| File | Size | What it is |
|---|---:|---|
| `TitlePipe reviewer flow.html` | 1,253,386 B | Self-extracting bundler wrapper. Contains the zip below as base64 plus an unpack shim. Not a source file. |
| `TitlePipe reviewer.zip` | 880,536 B | The actual package. |

The zip contains 5 entries:

| Entry | Size | What it is |
|---|---:|---|
| `TitlePipe.dc.html` | 341,224 B | **The design of record.** 3,536 lines. |
| `support.js` | 69,150 B | The `.dc` runtime that interprets it. |
| `TitlePipe reviewer flow.html` | 1,253,386 B | duplicate of the wrapper |
| `.thumbnail` | 24,838 B | SVG preview |
| `screenshots/nocard.png` | 40,979 B | one screenshot |

`TitlePipe.dc.html` is **declarative `.dc` markup**, not React and not Tailwind: a `<x-dc>` root,
`<helmet>` for head content, `<sc-if value="{{ … }}">` / template-expression control flow, and
**inline `style="…"` attributes throughout**, driven by a `:root` CSS custom-property block.
There is no JSX, no component file, no `className`, no Tailwind utility anywhere in it.

**Consequences.**

1. BRIEF §3 rule 2 ("never copy a block of JSX out of `design-export/`") has no JSX to name.
   The rule's *intent* is unchanged and still binds: read it, understand the visual result,
   close it, write the component yourself. The copyable substance here is the inline styles
   and the `:root` block — treat those exactly as the rule treats JSX.
2. BRIEF §6 forbids inline styles in `apps/web-v2`. The design is *entirely* inline styles.
   Translation to token-driven classes is therefore mandatory and total, not incidental.
3. `.claude/CLAUDE.md` already names `.dc.html` as the design pixel-spec format for this
   project ("`docs/archive/Title report review tool.zip` → `.dc.html` files"). This export is
   the same format as the previous design, not a new kind of artifact.

## D-2 — The design's own token block, as measured

From `TitlePipe.dc.html` `:root`. Recorded here as raw evidence only; semantic naming is Phase 1's job.

```
--ground:#e6e7ec   --panel:#ffffff   --paper:#faf9f4
--ink:#16171b      --ink2:#565a66    --ink3:#8a8e99
--rule:#d4d7de     --rule2:#e7e9ee
--violet:#4a2fae   --violet-ink:#392291  --violet-tint:#efeafd  --violet-tint2:#dfd6fb
--green:#2c7a4b    --green-tint:#e6f2ea
--red:#b02318      --red-tint:#fbe9e7    --red-ink:#8c1a12
--amber:#9a6a12    --amber-tint:#f8efd8
--marker:rgba(255,214,53,.5)  --marker-edge:#d9a400
```

Fonts: IBM Plex Sans (400/500/600/700), IBM Plex Mono (400/500/600), IBM Plex Serif (400/500/600 + italic 400) — loaded from Google Fonts.
Motion: one keyframe, `tp-pulse`. A `@media (prefers-reduced-motion: reduce)` block kills all animation and transition.
Focus: `:focus-visible{outline:2px solid var(--violet);outline-offset:2px}` — a global focus treatment already exists in the design.

**Note.** These are the same values the *existing* `packages/ui-tokens` was derived from
(violet action colour, `tp-pulse`, serif-for-quoted-text). The prior Phase 1 work was done
against this same package.

## D-3 — Phases 0, 1 and 2 already have completed deliverables on disk

BRIEF §5 orders Phase 0 → 1 → 2 with a mandatory stop after each. Seven of the eight §11
deliverables already exist, written 2026-07-26/27, committed on branch
`rahuldr07/frontend-pass1-remove-old-ui`:

| §11 deliverable | Path | Lines | State |
|---|---|---:|---|
| 1. test harvest | `docs/frontend/test-harvest.md` | 528 | exists |
| 2. tokens package | `packages/ui-tokens/` | — | exists (`src/tokens.css`) |
| 2. tokens doc | `docs/frontend/tokens.md` | — | **missing** |
| 3. component inventory | `docs/frontend/component-inventory.md` | 238 | exists |
| 4. design classification | `docs/frontend/design-classification.md` | 264 | exists |
| 5. Storybook | — | — | **missing** (not installed) |
| 6. open rulings | `docs/frontend/open-rulings.md` | 158 | exists |
| 7. conflicts | `docs/frontend/conflicts.md` | 137 | exists |
| 8. state coverage | `docs/frontend/state-coverage.md` | 191 | exists |

Plus two not in §11: `docs/frontend/decisions.md` (183) and `docs/frontend/replatform-mapping.md` (149).

## D-4 — The working-tree test suite is already a migrated copy

BRIEF §5 Phase 0 says to read the specs in `apps/web/`. **The working tree is no longer the
pre-rebuild suite.** It has already been harvested, moved, re-selectored and partly un-skipped
by the in-place rebuild on this branch.

| | Pristine — commit `ade49af` | Working tree today |
|---|---|---|
| e2e location | `apps/web/e2e/*.spec.ts` | `apps/web/e2e/invariants/*.spec.ts` |
| e2e files | 23 | 23 (moved, edited) |
| Vitest files | `authz.test.ts`, `vocabulary.test.ts` | + `noValue.test.ts`, `charDiff.test.ts` |
| `test.skip(` count | — | 0 (all un-skipped) |

`ade49af` ("Probe the images as production and assert they refuse an empty config") is the last
commit before frontend rebuild work began; `0aa0c70` ("Record the test harvest and design
classification before deleting anything") is the first.

**Consequence.** Any Phase 0 re-harvest must read specs from `git show ade49af:<path>`, not from
disk. Harvesting the working tree would measure the previous rebuild's output, not the rule set.

## D-5 — §4's API-client stack presupposes an OpenAPI schema that does not exist

BRIEF §4 requires `@hey-api/openapi-ts` and `openapi-typescript`; §7 makes generated OpenAPI
types the authoritative wire shapes.

**Measured.** `services/core-api` is FastAPI foundation only — `app.py`, `lifespan.py`,
`settings.py`, `telemetry/`, and tests. No route modules, therefore no meaningful schema to
generate from. The live wire contract is `packages/contract` (Zod 4), which
`.claude/CLAUDE.md` names "REST contract source of truth" and which `packages/mocks` (MSW)
is built on.

## D-6 — §4 forbids Zod in the browser, but the shared contract is Zod

BRIEF §4 says *"valibot NOT zod"* and *"Do not install: … zod in the browser bundle."*
BRIEF §9.14 scopes Valibot narrowly: *"Valibot is UI-only; every client rule needs a server counterpart."*

**Measured.** `packages/contract` is Zod 4. `apps/web/src/api.ts` parses every response through
it at the boundary. `packages/mocks` depends on it. BRIEF §7 says *"Data comes from
`packages/mocks` (MSW) … Reuse it"* and §13 says *"Do not fork `packages/mocks`."*

These cannot all hold at once. Reusing `packages/mocks` unforked means shipping its Zod contract;
removing Zod from the browser bundle means either forking the mocks or replacing the contract
package — both forbidden elsewhere in the same brief. Unresolved; see the open question logged
with the Phase 0 report.

## D-7 — `docs/frontend/PLAN.md` does not exist

BRIEF §5 Phase 0 defines ORPHAN RULE against `docs/CONTEXT.md`, `docs/PRD.md`, and
`docs/frontend/PLAN.md`. The third file is absent. The existing harvest substituted
`docs/prompts/frontend-master-prompt.md`, which the specs themselves cite by section number
(`§0.2`, `§0.4`, `§4.13`), and recorded that substitution in its §2. Absent a reason to differ,
the same substitution applies.

## D-8 — Owner rulings already recorded that BRIEF does not know about

`docs/frontend/decisions.md` carries three decisions, one of them an explicit owner reversal:

- **D1** — escalation resolution stays refused without a rule; the export's looser flow is overridden.
- **D2** — *"REVERSED by the owner, 2026-07-26. The design-mock pane ships as drawn."* The light
  document pane (`#dcdde3`) ships; an earlier contrast-based override (14.53:1 dark vs 1.29:1
  light) was withdrawn as not the implementer's call. `PdfPane` takes a `surround` variant.
- **D3** — `NaReason` ratified at four members: `NOT_PRESENT` · `NOT_FOUND` · `NOT_STATED` ·
  `PRESENT_UNREADABLE`, with `pending` as a fifth *render* deliberately outside the enum. The
  contract was widened additively.

D3 resolves BRIEF §8's *"which set ships is an unresolved ruling"* — it is now ruled.
D2 is an owner decision that overrides implementer judgment on a RENDER element.
These survive a fresh start; they are rulings, not code.
