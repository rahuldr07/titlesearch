# UI handoff — read this before writing any code

> **RECORD (2026-07-29).** Describes the frontend before the reskin. The current
> frontend handoff is [`HANDOFF-2026-08-01.md`](HANDOFF-2026-08-01.md); the
> approved visual reference is `directions/hybrid.html`, not the export named below.

**Written 2026-07-29.** Supersedes nothing; it sits beside `conflicts.md`,
`decisions.md` and `design-fidelity.md` and tells you where the frontend
actually is, what will bite you, and what you are being asked to build.

---

## 1. Your mandate

**The design of record is `design-export/TitlePipe reviewer flow.zip` →
`TitlePipe.dc.html` (3,779 lines, 18 screens), revised 2026-07-28.** It is a
substantial revision of the package the current build was made against — see §11
for exactly what changed, because several things in this document describe the
OLD design and are called out there.

Build it **faithfully** — the layout,
the copy, the proportions, the states. The design is the specification, not a
mood board. Where the design and this document disagree about *appearance*, the
design wins. Where they disagree about a *product rule* (§4 below), the rule
wins and you record the conflict rather than resolving it silently.

**Write the best code you can.** Not the fastest route to a screenshot.

- **Common components, aggressively.** If two screens draw the same thing, it is
  one component. The previous build drifted into near-identical row renderers in
  four places; that is the failure to avoid.
- **You may use any package you want**, including anything open source. You are
  expected to **research** rather than reach for what you already know — check
  what is current, read the docs, compare. The stack below is what exists today,
  not a constraint you have inherited.
- **Every component is documented with WHY**, in the house style: what rule it
  enforces and what failure it prevents. Not a restatement of the code. Read any
  existing file in `src/features/review/` for the register.

---

## 2. What this product is

TitlePipe is an internal US title-abstracting production system. Scanned county
packages (36–181 pages) are machine-extracted into 132 fields; a human reviewer
resolves the uncertain ones; a report is delivered to a client.

The three documents that govern it are `docs/HANDOFF.md`, `docs/CONTEXT.md` (§11
is mandatory — domain traps you cannot derive from code or screens) and
`docs/PRD.md`. Read `CONTEXT.md` §11 before you touch field rendering.

---

## 3. Where the build stands

Single app: **`apps/web-v2`**. `apps/web` (the v1 build) was deleted 2026-07-29;
an empty locked directory may remain, it has no `package.json` and pnpm ignores
it.

| | |
|---|---|
| Screens | 19 feature folders, 20 routes |
| Shared kit | 19 components in `src/shared/ui/` |
| Invariant tests | 49 passing + 1 `fixme`, across 12 spec files |
| Route smoke | 20 routes, `e2e/smoke/routes.spec.ts` |
| Unit | 212 across 39 files |
| Gates | `check:rules` (256 files), `typecheck`, `lint`, `knip`, `build` |

**Stack today:** React 19 · TypeScript 6 strict (`exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`, `erasableSyntaxOnly`) · Vite 8 · Tailwind v4 ·
TanStack Query/Router/Table/Virtual · react-hook-form + valibot · zustand
(ephemeral UI state only) · react-hotkeys-hook · Vitest · Playwright · MSW 2.

**Component libraries:** 9 of the 19 kit components wrap `@base-ui/react`; the
other 10 are plain Tailwind + `cva`. **This is the layer most likely to change** —
see §7.

---

## 4. Product rules that are NOT style

These are release blockers. They are enforced by tests, and a design that
contradicts one is a conflict to record in `conflicts.md`, not a thing to build.

1. **Never render a value without provenance.** A value with no document, page
   or reading behind it renders as a visible error, never as an ordinary value.
2. **Never collapse the NA states.** `NOT_PRESENT` / `NOT_FOUND` / `NOT_STATED` /
   `PRESENT_UNREADABLE` are four different statements about the document.
   `pending` is a fifth thing — the pipeline has not looked — and must never read
   as "Not Available". They must stay distinguishable in **greyscale**: border
   style and fill pattern carry the distinction, colour is secondary.
   `src/entities/field/noValueStates.ts` is the authority; it rules six renders.
3. **The server owns every state machine.** Never derive `state` from confidence,
   never re-derive counts, chain termination or a gate verdict client-side.
4. **No approve-all, no bulk confirm, no queue cherry-picking.** These are absent,
   not disabled.
5. **No throughput counters, no per-person productivity, no aggregate accuracy
   headline, no timers.** A count of what is left is fine; a rate is not.
6. **Refusals need reasons.** A correction needs its reason, an escalation needs
   its question, a pass needs its why, a ruling needs its citation, a suppression
   needs its reason. The contract enforces each with `min(1)`, so the server
   refuses too — the disabled button is the courtesy, not the enforcement.
7. **Judgments never auto-confirm.** Engine self-confidence never gates anything.
8. **Nothing in localStorage or sessionStorage.** User preferences live on the
   server — `GET/PATCH /api/me/preferences` already exists.
9. **No optimistic updates on a field decision.** A 409 is an ANSWER and must
   render with the server's message verbatim.

---

## 5. Architecture you should keep

**`packages/contract`** — Zod schemas, the REST contract source of truth, shared
with `packages/mocks`. Seven files: `enums`, `entities`, `endpoints`, `authz`,
`workspace` (products/clients/config), `intake` (sign-off, pipeline, gate,
lifecycle, people, profile, preferences), `index`.

**`packages/mocks`** — MSW 2. **This IS the backend until FastAPI lands** (root
`CLAUDE.md` says so). Fixtures belong here, never as private constants inside a
screen. A screen carrying its own data is data nothing validates and no real API
can replace.

**The wire boundary is `src/shared/api.ts`.** Every response parses through a
contract schema before it reaches a component. Never widen a contract type
locally — emit a `CONTRACT GAP:` comment instead.

**Read shapes only.** The contract has GETs for the config/admin layer and
deliberately no writes for it: publishing a grid, closing a completeness gate,
starting the pipeline are transitions the server owns, and rulings Q4–Q10 have
not settled what they mean. Write buttons render **visible and disabled** with a
`CONTRACT GAP:` note, so the affordance still says the operation exists.

**`packages/ui-tokens/src/tokens.css`** — 94 semantic colour tokens
(`surface-*`, `ink-*`, `line-*`, `action*`, `state-*`, `na-*`) plus type, radius,
spacing, shadow scales. Components read semantic names, never palette values.
This is what makes a second theme cheap.

---

## 6. Traps — every one of these cost real time

**`--color-surface-document` is the grey BACKDROP a page sits on, not the paper.**
The paper is `surface-panel`. Getting them the wrong way round renders a scanned
document as a grey slab. *Symptom: the document pane looks like a data panel.*

**`cn` needs its `extendTailwindMerge` config.** Without it `tailwind-merge` does
not know our custom scales and silently drops the earlier class — `cn("text-micro",
"text-ink-muted")` returned only the colour, killing the font size on every
eyebrow in the app. *Symptom: a size class you wrote has no effect.*

**Tailwind v4 `@theme` namespaces are not uniform.** `--space-*`, `--z-*` and
`--filter-*` generate **no utilities at all**; `--stroke-*` generates the wrong
property (SVG `stroke:`). The workarounds in place are a `--spacing: 2px` base,
`z-(--z-popup)` shorthand, and `@utility` blocks. *Symptom: a token exists and
the class does nothing.* **Always grep the built CSS to confirm a utility emits.**

**The spacing base is 2px.** `max-w-400` is 800px, not 400px. The app shell was
capped at `max-w-400` and starved every wide screen — a seven-column board
overflowed by 426px with two columns hidden behind a scrollbar that had no
affordance, at every window size. *Symptom: content truncated identically at all
viewport widths.* A viewport-based guard will not catch this; the binding
constraint is the **container**.

**A CSS `text-transform` does not change what text says.** Where a test or the
design needs literal capitals, write them in the markup.

**react-hotkeys-hook does not recognise `?` or `[`** as hotkey names. Both were
registered and never fired. They are matched on the character with an explicit
keydown listener plus a hand-written input guard. *Symptom: a shortcut that
demonstrably does nothing, with no error.*

**`doorsFor` treats a path with NO authz row as OPEN.** The authz table lists the
screens whose access is *restricted*, not every screen that exists. Reading a
missing row as a refusal hides the entire order flow from everyone and silently
kills the keyboard chords.

**FIXED (task 5): the account menu's `MenuGroupLabel` needs a `MenuGroup`
ancestor.** Clicking Base UI's `Menu.Trigger` used to unmount the whole chrome.
The actual throw (invisible until the console was checked) was `Base UI:
MenuGroupContext is missing` — `Menu.GroupLabel` reads its id off
`Menu.Group`'s context and throws synchronously without it, and nothing here
had an error boundary to catch it. `AccountMenu.tsx` used `MenuGroupLabel` as a
bare section heading; the fix wraps each label with its items in the kit's new
`MenuGroup` (`src/shared/ui/Menu.tsx`), fixed in place — no library swap
needed. Both tests that were `fixme`'d on it (`authz.spec.ts`'s engineer gate,
`sidebar.spec.ts`'s door-absence test) are un-`fixme`'d and pass.

**`compare.mjs` and Git Bash.** Git Bash rewrites a leading-slash argument into a
Windows path (`/queue` → `C:/Program Files/Git/queue`). The helper recovers from
it; if you write another script, handle it.

**MSW state resets on page load.** Every mock store is per-session by design. The
one exception is preferences, which uses `sessionStorage` *inside the mock* as
the mock's stand-in for a database — the **app** never touches browser storage.

---

## 7. The kit decision — researched, not settled

Current: 9 components on `@base-ui/react`, 10 on plain Tailwind + `cva`.

**shadcn/ui was the standing recommendation** and it holds up: Tailwind v4 and
React 19 fully supported, you own the source so nothing is version-locked, Radix
has the strongest keyboard and a11y behaviour of the headless libraries — which
matters because this app is keyboard-driven with tested chords. `lucide-react`,
`sonner`, `cmdk`, `cva`, `clsx` and `tailwind-merge` are already installed.

**shadcn CLI v4 (2026) has a preset system** worth using:

```
pnpm dlx shadcn@latest preset decode <code>     # inspect one
pnpm dlx shadcn@latest preset resolve -c apps/web-v2
pnpm dlx shadcn@latest preset open <code>       # customise visually
pnpm dlx shadcn@latest apply <code>             # switch preset in place
```

`apply` supports **partial application** — take just the theme, or just the
fonts, keeping your own components.

**But treat this as open.** You are explicitly permitted to research and choose
differently. Mantine v9, Ark UI/Park UI, and Base UI itself are all live options;
the honest trade is *Mantine wins on speed and completeness, shadcn wins on
control and ownership*. Two constraints on whatever you pick:

- **The rule picker on the escalation screen must stay a native `<select>`.**
  Playwright's `selectOption` only drives native selects.
- **Keep the behaviour already earned:** `DestructiveConfirm` moves focus when it
  arms; `RequiredComment` keeps its submit enabled and explains the refusal on
  click; the NA renders must survive greyscale.

---

## 8. Two themes

Agreed 2026-07-29: **TitlePipe (light)** and **Catppuccin Mocha (dark)**.

⚠ **The light theme must be REBUILT from the revised palette (§11), not reused.**
The current `:root` holds the OLD cool/violet register. The new design is warm
archival. Both themes are new work. Because all 94 tokens are semantic and every component
reads them by name, a theme is a second block of values under the same names and
**no component changes**.

```
:root                → TitlePipe (light)
[data-theme="mocha"] → Catppuccin Mocha
```

Proposed mapping (Mocha layers *upward* from base, so panels go lighter):

| token | Mocha | token | Mocha |
|---|---|---|---|
| `surface-app` | base `#1e1e2e` | `ink-primary` | text `#cdd6f4` |
| `surface-panel` | surface0 `#313244` | `ink-secondary` | subtext1 `#bac2de` |
| `surface-sunken` | mantle `#181825` | `ink-muted` | subtext0 `#a6adc8` |
| `line-subtle` | surface1 `#45475a` | `action` | mauve `#cba6f7` |
| `line-strong` | surface2 `#585b70` | `state-settled` | green `#a6e3a1` |
| `scrim` | crust `#11111b` | `state-attend` | peach `#fab387` |
| | | `state-halt` | red `#f38ba8` |

Three decisions taken:

1. **The document does not invert.** A scan is a photograph of paper. The
   surround darkens; the page stays light. `--color-surface-paper` is pinned
   light in both themes.
2. **Strict AA applies to both themes.** `src/shared/contrast.test.ts` reads the
   token file and must now pass twice. Stock Mocha's `overlay0 #6c7086` is around
   4:1 on base — marginal for body text. Where stock Catppuccin fails the gate,
   deviate and say where.
3. **Default is TitlePipe light**, Mocha opt-in, persisted via
   `/api/me/preferences` (add a `theme` field beside `nav_collapsed`).

---

## 9. Still open — not the frontend's call

- **Q4–Q10** — the intake config layer (products, sign-off, completeness gate,
  client overrides, config versioning). Those screens render read-only.
- **Q13** sign-off prefill · **Q14** post-delivery reopen/v2 · **Q15** escalation
  ownership ("take the order over") · **Q16** whether the MFA gate blocks.
- **C18** — `✕ Not our party` is implemented as `excluded_reason` on `Field`
  rather than a `FieldState` member, because an added enum case broke v1's
  exhaustive switches. With `apps/web` gone that constraint is lifted; the
  orthogonal field is still the better model, but it can be revisited.

---

## 10. How to verify — all of it, every time

```
pnpm --filter web-v2 typecheck
pnpm --filter web-v2 check:rules      # colour/size/import/storage gates
pnpm --filter web-v2 lint
pnpm --filter web-v2 test             # Vitest: unit + storybook + a11y
pnpm --filter web-v2 test:e2e         # Playwright, builds and previews first
pnpm --filter web-v2 knip
pnpm typecheck                        # every package
```

**`check:rules` is a real gate**, not advice: no hex outside the token package,
no arbitrary Tailwind values, no inline styles, no `!important`, no browser
storage, no TS escape hatches, no cross-feature imports, **150 lines per file**.
A `rules-allow:` escape needs a reason of at least 12 characters.

**And look at the screens.** `apps/web-v2/compare.mjs` captures the design and
the app side by side:

```
node compare.mjs <DesignMenuLabel> <app-route> ../../shots
```

It found the draft report rendering every value outside its own row, a lifecycle
board hiding two stages, and the delivered screen confirming the wrong order —
none of which a fully green test suite could see. **A passing suite is not
evidence the UI is right.**


---

## 11. What the 2026-07-28 revision changed

The design was revised after most of the current build was written. Same 18
screens, ~630 changed lines. Anything below overrides what this document says
elsewhere.

### The palette was replaced — "warm archival"

Paper ground, deep navy primary, oxblood and ochre semantics. **The token names
are deliberately unchanged** (`--violet` is still the primary accent, it is now
navy) so the entire app reskins from one block with no per-element edits. Do the
same: change values, not names.

```
--ground  #eae7e0   --panel  #fdfcfa   --panel2 #f7f4ee   --paper #fbfaf5
--ink     #201f1d   --ink2   #585349   --ink3   #8b857a
--rule    #d9d4c9   --rule2  #eae6de
--violet  #2e4272   --violet-ink #1f2f57  --violet-tint #e9ecf4  --violet-tint2 #d2dae9
--green   #2f6d46   --green-tint #e5efe7  --green-edge  #c2d8c6  --green-deep  #22553a
--red     #9c2b1e   --red-tint   #f8e8e4  --red-edge    #e8cdc5  --red-ink     #7c2016
--amber   #8a6413   --amber-tint #f6eed6  --amber-edge  #e2d2a6  --amber-deep  #6b4f10
--marker  rgba(240,201,92,.45)   --marker-edge #c2922b
```

**Body font is `Libre Franklin`**, not IBM Plex.

### Navigation is a LEFT SIDEBAR again, not a top bar

The current build has a top chrome strip. **That is wrong now.** The revision
draws a collapsible left sidebar:

- 232px wide, 78px collapsed. Row height 40px wide / 44px collapsed — the
  collapsed width is sized so the icon target clears 44px after the scrollbar.
- Collapse is **forced** at narrow widths; labels do not fit and an icon rail
  beats a modal for navigation you use constantly.
- It **starts collapsed on Review** — that screen needs every pixel, scan left,
  decisions right — and an explicit toggle wins from then on. Never override a
  choice the user actually made.
- Items carry an initial-letter icon when collapsed and a badge when wide, with
  red/amber tones. Grouped, plus a lifecycle "flow" rail.

**This vindicates `sidebar.spec`.** Three of its six invariants were deleted on
2026-07-29 along with the screens they referenced (attention dots on
`/complaints`, role-absent doors for `/dashboard` `/bench` `/leaderboard`, and
the capture seat having no rail). The surviving two — `[` folds it, and `[`
inside a text field is text — now match the design exactly. Recover the deleted
ones from git if the rules still apply to the new door set.

### Review gains two features

- **A coverage spine over the whole package**, not just the pages a reader
  typed. It answers "what have I not looked at", which the read-pages chip strip
  could not. `Coverage · all 64 pages`, with a legend and summary.
- **A section rail and decision dock** — jump to a report section, decision
  progress, and `Rest of the queue · N`.

### Correction semantics tightened

- **A correction must actually change something.** Empty, or identical to what
  the machine read, is **refused** rather than recorded as a correction that
  changed nothing. The submit is inert until the value differs.
- **`e` puts you IN the field.** It previously committed immediately, using the
  machine's own value when the field was untouched.
- **Enter commits from inside the field, Escape leaves it** — handled above the
  input guard, so the field needs no handler of its own.

### Smaller

- Rulebook pending chip reads **"PENDING — AFFECTS NOTHING YET"**, with a
  citation field and a retire preview whose absence is stated rather than hidden.
- Finalize block restructured; the abstractor-said-NO disclosure cards moved.
