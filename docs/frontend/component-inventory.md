# Component inventory — shadcn mapping + custom specs

Every recurring element in the export, mapped to a shadcn/ui primitive or specified as a custom component. Nothing built yet.

---

## 1. Direct shadcn mappings

Copied in via CLI, re-themed to `@titlepipe/ui-tokens`. No behavioural changes.

| Design element | shadcn primitive | Theming notes |
|---|---|---|
| Account dropdown | `dropdown-menu` | Sections + separators; 256px; `--shadow-menu` |
| Screen nav tabs | `tabs` | Segmented pill inside a `--color-surface-app` track |
| Config tabs, client tabs, rule filters | `tabs` / `toggle-group` | Filters carry counts — `toggle-group` with a count slot |
| Product / client / role chips | `toggle-group` (single) | Chips are radios, not buttons — must be keyboard-navigable as a group |
| Edit drawer (line / product / client) | `sheet` | Right side, 460px, `max-width:92vw` |
| Scrim + drawer dismiss | `sheet` | Design stops click propagation on the panel |
| Text inputs, textareas | `input`, `textarea` | Required fields get `--color-state-halt-border` |
| Reduced-motion / keyboard toggles | `switch` | 42×24 track, 20px knob |
| Baseline-line select | `select` | |
| Draft-mode radio (cite vs draft) | `radio-group` | |
| Golden-offer / acknowledge checkbox | `checkbox` | |
| Compare-matrix cell tooltips | `tooltip` | Design uses `title=` — must become a real tooltip for a11y |
| Rule list / decision list | *(none)* | Plain semantic lists; virtualize only past ~50 rows |
| People table, audit log, compare matrix | `table` + TanStack Table | Audit and compare are read-only |
| Confirm/retire destructive steps | `alert-dialog` | Design uses inline arm-then-confirm; keep inline, borrow focus semantics |

**Not used, deliberately:** `accordion` (decision cards do their own expand), `command`, `popover` for the account menu (`dropdown-menu` is correct), `toast` (the design surfaces every outcome inline, which is the better pattern here — see O10).

---

## 2. Custom components

Twelve. These have no shadcn equivalent because they encode product rules.

### 2.1 `NoValue` — **the most important component in the app**

Renders a field that has no value. **A five-arm discriminated union with an exhaustive switch and a `never` guard.**

```ts
type NoValueKind =
  | { kind: "pending" }                 // not yet extracted — NOT an NA state
  | { kind: "not_present" }             // structurally absent in this jurisdiction
  | { kind: "not_found" }               // searched, none of record
  | { kind: "silent" }                  // present, does not state it
  | { kind: "unreadable"; page: number } // present but unreadable
```

| Arm | Visual (from design) | Routes |
|---|---|---|
| `pending` | **NOT DRAWN — needs redraw.** Must not resemble any NA state | never surfaced for review |
| `not_present` | Dashed border, italic `--font-quote`, muted — *"n/a — not used in this jurisdiction"* | never surfaced — it is correct |
| `not_found` | Solid border, short dash glyph — *"Not found — searched, none of record"* | surfaced |
| `silent` | Diagonal hatch fill — *"Document silent — not stated on any page"* | surfaced |
| `unreadable` | Halt-tinted, `◑` glyph, **plus a page chip** — *"Present — unreadable on page"* | always surfaced |

**Rules**
- Distinction is carried by **border-style and fill pattern as well as colour** — survives greyscale and colour-blindness. The design already does this; do not "simplify" to colour-only.
- `unreadable` is the only arm that carries a page reference, and it must.
- No arm may be reached by defaulting. The `never` guard is the point.
- **The 4-NA set is unratified** — `open-rulings.md` Q1. Contract ships 2.

**A11y:** each arm needs distinct accessible text, not just a visual. `aria-label` carries the full phrase; the glyph is `aria-hidden`.

---

### 2.2 `FieldValue`

Renders a field that *has* a value, in five presentations: `machine` (mono + page chip), `correction` (violet, underlined, "Your correction"), `excluded` (struck through + "Excluded — not our party"), `escalated` (amber + "↗ Escalated to senior review"), `note` (serif prose, no value).

**Rules**
- A value **must** carry a page chip. A value with no provenance renders as a hard error, never a bare value (`review.spec` #2, INVARIANT). The design has no error arm — **needs a redraw.**
- `auto_confirmed` and `confirmed` currently render identically — gap, see `state-coverage.md` §2.2.

---

### 2.3 `PageChip`
Mono `p{n}`, violet tint, clickable → scrolls the document pane and highlights. Present on every cited value. **A11y:** a real button — "View source on page 3", not a decorative span.

---

### 2.4 `DocumentPane` + `EvidenceOverlay`
react-pdf page render, zoom, page nav, and an absolutely-positioned highlight layer scaled to the rendered page.

- Accepts an opaque `line_coords` payload; **isolate the coordinate mapping in exactly one function** (master §3) — the real shape lands with the LLMWhisperer adapter.
- Engines that declare no coordinates get **no overlay and a snippet instead** — never a faked box (`leaderboard.spec` #2's "declared-not-faked" principle applied to the page).
- Highlight uses `--color-surface-evidence` with `mix-blend-mode: multiply` so the scan reads through.
- Must render the **"Not read in full"** state for uncaptured pages — never a blank pane.
- Scan filters (`--filter-scan`) make it look scanned; keep.

**A11y:** the overlay is decorative; the citation lives in text. Zoom must be keyboard-reachable.

---

### 2.5 `PageStrip`
Row of page buttons for pages read in full, with the current page marked. Header states the ratio ("11 of 64"). **A11y:** `role="tablist"`-like semantics; current page is `aria-current`.

---

### 2.6 `DecisionCard`
The reviewer's unit of work. Collapsed (status dot, section·field, value, status label) and expanded (question, why, current value, actions).

**Rules**
- The **question framing** (`asking`) is the design's best idea — keep it.
- Must show **both engine readings with attribution**, not one anonymous `suggested` (conflict C7).
- Correction requires a **reason** (C8). Escalation requires a **question** (C9). Neither is drawn.
- No optimistic update — the server's returned state is the truth. A 409 renders the server's message and does **not** advance the selection (`review-conflict.spec`, 3 INVARIANTs).
- Keyboard: `C` confirm · `E` correct · `N` not-our-party · `↑↓`/`J`/`K` move. Suspended inside inputs.

**A11y:** collapsed card is a button; expanding moves focus to the question. Status dot needs a text equivalent.

---

### 2.7 `StatusStamp`
Rotated, double-bordered, mono-caps rubber stamp. Distinctive; keep exactly.

**Rule:** label and tone come **from the server** (conflict C2). This is a display component with no logic.

---

### 2.8 `StageList`
Pipeline stages with dot, title, sub-copy, actor badge. Dot states: done / gate / halted / waiting. Halted and gate dots pulse (`tp-pulse`, honours reduced-motion).

**Rule:** phase per stage comes from the server (conflict C3).
**A11y:** pulsing is not the only signal — the badge text carries it.

---

### 2.9 `ClaimVsEvidence`
The completeness gate's core pattern: "You said …" / "We found …" stacked with aligned labels, plus an optional **Provisional** band when the check has no evidence behind it.

Generalise this — it is the right shape anywhere the machine contradicts a human, and the provisional band is principle 6 applied to checks (`state-coverage.md` §6).

---

### 2.10 `RequiredComment`
Textarea + submit, disabled until non-empty, with a nudge naming what is missing on refused submit. Used by: root-of-title, product change, v2 reopen, sign-off NO, rule citation, escalation ruling, correction reason, escalation question.

**This one component carries most of the §0.5 refusal rules.** Build it once, carefully. Every refusal must say why (harvested O10).

**A11y:** `aria-describedby` links the nudge to the control; the disabled state must be announced.

---

### 2.11 `ProvenanceBadge` / `OriginLabel`
Small uppercase label stating where a thing came from — `baseline` / `narrowed` / `replaced` / `added` for config lines, `RULED` / `DERIVED` / `OPEN` / `CONFLICT` for rules.

Design's rule: *"a line with no traceable source is a config defect, the same discipline as field provenance."* There is no "unknown" variant, deliberately.

---

### 2.12 `ScreenFailure`
Error boundary card. **Implement with the design's copy verbatim:**

> *"Something went wrong building this screen — so it isn't showing you anything, rather than showing a blank that could be mistaken for real configuration. Your data is unchanged."*

Wrap any screen whose view-model can throw. This is harvested orphan **O6**, stated better than my own prose.

---

## 3. Layout shells

| Shell | Notes |
|---|---|
| `AppChrome` | Header + nav + counts + stamp + account menu. Hidden on sign-in/session-ended (`showChrome`) |
| `CenteredFlow` | Single-column max-560/640/700px — upload, questions, processing, delivered, sign-in |
| `WideScroll` | max-720–1340px — queue, overview, admin |
| `SplitWorkbench` | Review only. 52/48 doc/fields; collapses to tabs under 900px |

Responsive breakpoints in the design: `narrow < 900px`, `compact < 1180px`. Only two.

---

## 4. Accessibility debt in the export

The prototype is inline-styled HTML with no semantics. Every item below must be added during implementation — none is a design change:

1. **No focus management.** Expanding a decision card, opening the drawer, and closing a modal must move focus. Only a global `:focus-visible` outline exists.
2. **Colour-only status in three places** — rail dots, decision status dots, grid cells (`●`/`◐`/`—`). The grid glyphs are fine; the dots need text.
3. **`title=` used as tooltip** on compare-matrix cells — not keyboard-reachable. Use the `tooltip` primitive.
4. **No live regions.** Refusal nudges, gap closures, and stamp changes need `aria-live="polite"`.
5. **Chip groups are `<button>` soups** — should be radio groups with arrow-key navigation.
6. **Contrast — one failing token.** Measured WCAG ratios for the extracted palette:

   | Token | On panel `#ffffff` | On app `#e6e7ec` | AA (4.5:1) |
   |---|---:|---:|---|
   | `--color-ink-muted` `#8a8e99` | **3.28** | **2.65** | ❌ **fails both** |
   | `--color-ink-secondary` `#565a66` | 6.89 | — | ✅ |
   | `--color-action` `#4a2fae` | 9.09 | — | ✅ |
   | `--color-state-attend` `#9a6a12` | 4.73 | — | ✅ |
   | `--color-state-settled` `#2c7a4b` | 5.26 | — | ✅ |
   | `--color-state-halt` `#b02318` | 6.78 | — | ✅ |

   Everything passes except `--color-ink-muted`, which is used for eyebrow labels, meta text, and the "recede" tier throughout — the most-used token in the design. It fails on both surfaces and fails large-text AA (3:1) on the app surface too.

   **This is the one real accessibility defect in the palette.** Options: darken to ≈`#6f7480` (≈4.5:1 on panel), or restrict it strictly to non-essential decoration and move all meaningful text to `--color-ink-secondary`. Needs a decision — it touches nearly every screen.
7. **Heading order** — screens jump from `h1` to styled `div`s. Needs a real hierarchy.
8. Keyboard hints are rendered as text; they also need to be discoverable (the old app's `?` map did this well).

---

## 5. Scale rounding table

The design used **22 distinct font sizes** and **12 radii** with no system. `packages/ui-tokens` imposes a scale. What moved:

### Type — 22 sizes → 12 steps
| Source sizes | Token | Value |
|---|---|---|
| 8, 8.5, 9, 9.5 | `--text-micro` | 9px |
| 10, 10.5 | `--text-tiny` | 10px |
| 11, 11.5 | `--text-xs` | 11px |
| 12 | `--text-sm` | 12px |
| 12.5 | `--text-base` | 12.5px |
| 13, 13.5 | `--text-md` | 13px |
| 14 | `--text-lg` | 14px |
| 15, 16, 17 | `--text-xl` | 16px |
| 18 | `--text-2xl` | 18px |
| 20, 22, 23 | `--text-3xl` | 22px |
| 24 | `--text-4xl` | 24px |
| 26 | `--text-5xl` | 26px |

Largest single shift: 17px → 16px and 23px → 22px. Both are one-off headings; neither changes the hierarchy.

`--text-sm` (12) and `--text-base` (12.5) are kept as separate steps because the design uses both heavily and adjacently — collapsing them flattens the density difference between table rows and panel body.

### Radius — 12 → 6 steps
| Source | Token |
|---|---|
| 2, 3 | `--radius-xs` (3px) |
| 4, 5 | `--radius-sm` (5px) |
| 6, 7 | `--radius-md` (7px) |
| 8, 9, 10 | `--radius-lg` (10px) |
| 12 | `--radius-xl` (12px) |
| 20 | `--radius-pill` |

### Colour — 8 raw hex values had no token
`#dcdde3`, `#1f5738`, `#bfe0cb`, `#eec6c1`, `#e6d3a3`, `#6d4c0c`, `#fbfbfc`, `#eceef2` were inline literals. All are now named in `tokens.css` and marked `ORPHANED IN SOURCE`. Values preserved exactly.
