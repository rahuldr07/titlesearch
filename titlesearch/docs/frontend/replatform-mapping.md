# Re-platform mapping — the 12 measurement screens

**Decision (owner, 2026-07-26): the 12 measurement screens keep their design and are re-platformed against the new tokens.** They are in scope. Their harvested invariants stay in scope with them.

This file is the mechanical path: old token → new token, plus the gaps that need a decision.

---

## 1. Scope

| Screen | Current impl | Uses `PdfPane`? |
|---|---|---|
| Ops Dashboard | `screens/OpsDashboard.tsx` | no |
| Derived drill-down | (in OpsDashboard) | no |
| Delivery | `screens/Delivery.tsx` | no |
| Complaints | `screens/Complaints.tsx` | no |
| Golden Set capture | `screens/GoldenSet.tsx` | no |
| Seed Correction | `screens/SeedCorrection.tsx` | **yes** |
| Extraction Bench | `screens/ExtractionBench.tsx` | **yes** |
| Bench Results | `screens/BenchResults.tsx` | no |
| Blind Fifty typist | `screens/BlindFifty.tsx` | no |
| Blind Fifty Status | `screens/BlindStatus.tsx` | no |
| Reconciliation | `screens/Reconciliation.tsx` | **yes** |
| Engine Leaderboard | `screens/EngineLeaderboard.tsx` | no |

Pixel spec of record: `docs/archive/Title report review tool.zip` (.dc.html), plus the current React implementations and three reference screenshots in `docs/archive/`.

**Re-platform = new architecture + new tokens, same layout, hierarchy, copy and behaviour.** Not a redesign. Where a screen's current behaviour is pinned by a harvested INVARIANT, the invariant governs and the screen does not change.

---

## 2. THE decision this surfaces — the dark source pane

`apps/web/src/index.css` carries ~25 `--color-dk-*` tokens for what it calls:

> *"Source pane (Review right half) — the one deliberately dark region: the scanned document is the dominant visual, everything else recedes."*

That is HANDOFF §4's design register (*"dark, CI-output quiet, scan/document dominant"*) surviving precisely where the scan lives. I previously reported the dark register as dead; that was wrong — it is alive in the document pane and only there.

**The new design inverts it.** Its document pane is `#dcdde3`, a light mid-grey.

`PdfPane` is shared by Review + Extraction Bench + Reconciliation + Seed Correction (master §3, built once). So there is now one component with two registers pulling at it:

| Option | Result | Cost |
|---|---|---|
| **A — light pane everywhere** | Follows the new design. One register. | Changes the character of 3 measurement screens; drops the documented "everything else recedes" rationale. Seed Correction loses its `--color-dk-deep` terminal register entirely. |
| **B — dark pane everywhere**, incl. new Review | Preserves the documented rationale; one register; `--color-dk-*` survives as a scoped sub-palette. | Departs from the new design on its flagship screen. |
| **C — light in Review, dark in the other three** | Each screen matches its own spec. | Two registers for the same component. Rejected — this is how an app stops looking like one product. |

### RESOLVED — owner: implement `design-mock/` as drawn. Option **C**.

- **Review** → light pane `#dcdde3`, per `design-mock`.
- **Extraction Bench, Reconciliation, Seed Correction** → stay dark; they are measurement screens and keep their own design.

`PdfPane` takes a `surround: "light" | "dark"` variant. `--color-document-*` tokens remain for the three dark screens.

I had decided the opposite (dark everywhere) on a contrast measurement — page-vs-surround is 14.53:1 dark versus 1.29:1 light. That measurement is still true and is recorded in `decisions.md` D2 for whoever revisits this. It was not mine to act on: a rendering choice belongs to the design.

---

## 3. Token mapping — mechanical

Old tokens are semantically named already, which makes most of this one-to-one. `→` = direct substitution.

### Surfaces
| Old | New | Note |
|---|---|---|
| `--color-bg` `#edeae2` | `--color-surface-app` | |
| `--color-card` `#ffffff` | `--color-surface-panel` | |
| `--color-surface` `#f6f4ee` | `--color-surface-panel` | ⚠️ **level lost** — see 4.1 |
| `--color-surface-dim` `#f1eee6` | `--color-surface-sunken` | |
| `--color-input` `#fcfbf7` | `--color-surface-panel` | New design's inputs are white on panel |
| `--color-track` `#efebe0` | **GAP** | progress tracks — see 4.2 |

### Ink
| Old | New |
|---|---|
| `--color-ink` `#1f1c17` | `--color-ink-primary` |
| `--color-ink-body` `#3e3a32` | `--color-ink-primary` |
| `--color-ink-secondary` `#57524a` | `--color-ink-secondary` |
| `--color-ink-dim` `#8a857a` | `--color-ink-secondary` ⚠️ **not** `-muted` — see 4.3 |
| `--color-ink-faint` `#a39d8f` | `--color-ink-muted` |
| `--color-label` `#6e685c` | `--color-ink-secondary` |
| `--color-ink-invert` `#ffffff` | **GAP** — add `--color-ink-on-action` |

### Lines
`--color-line-strong` → `--color-line-strong` · `--color-line`, `--color-line-mid` → `--color-line-strong` · `--color-line-light`, `--color-hairline` → `--color-line-subtle` · `--color-dash` → **GAP** (dashed borders + scrollbar thumb)

### Semantic states — the important ones
| Old | New | Note |
|---|---|---|
| `--color-action*` (blue `#23508f`) | `--color-action*` (violet) | **Hue change.** Semantics identical, so substitution is safe. |
| `--color-act*` (hot red) | `--color-state-halt*` | |
| `--color-ok*` (green) | `--color-state-settled*` | `--color-ok-soft` (segment bars) → **GAP** |
| `--color-attend*` (amber) | `--color-state-attend*` | `--color-attend-strong` → `--color-state-attend-ink` |
| `--color-neutral*` (slate — idle/abandoned) | **GAP** | only `--color-chip-neutral-surface` exists — see 4.4 |

### Document / evidence
| Old | New |
|---|---|
| `--color-page` `#fdfdfb` | `--color-surface-paper` |
| `--color-hl-bg` | `--color-surface-evidence` |
| `--color-hl-low` `#b07a15` | `--color-border-evidence` |
| `--color-pin-bg` | **GAP** — the pin (vs highlight) treatment |
| `--color-page-bar`, `--color-page-line`, `--color-scan*` | **GAP** — mock-scan textures; new design uses `--filter-scan` instead |
| `--color-dk-*` (25) | **BLOCKED on §2** |

### Row states
`--color-sel-bg` → `--color-action-surface` · `--color-sel-missing-bg` → `--color-state-halt-surface` · `--color-chip-low-bg` → `--color-state-attend-surface` · `--color-na-ink` → `--color-na-not-present-ink` · `--color-row-hover` → **GAP**

### Shape
| Old | New | Note |
|---|---|---|
| `--radius-card` 6px | `--radius-md` 7px | +1px |
| `--radius-btn` 4px | `--radius-sm` 5px | +1px |
| `--radius-chip` 3px | `--radius-xs` 3px | exact |
| `--shadow-card`, `--shadow-pop` | **GAP** | new set has page/menu/drawer only |
| `--font-sans`, `--font-mono` | same | unchanged |
| — | `--font-quote` | new; serif = human testimony |

**The old design had no serif.** The new one uses it semantically for quoted human text. Re-platformed screens have a lot of quoted human text — ruling reasons, correction reasons, citations, complaint text. Applying `--font-quote` there is a *visual change* the "keep their design" decision does not authorise. Flagged in 4.5.

---

## 4. Gaps needing a decision

**4.1 — Three surface levels become two.** Old: page → panel (`#f6f4ee`) → card (white). New: app → panel (white). The middle level is gone. Screens that used `--color-surface` for a header band and `--color-card` for cards inside it will flatten. **Fix:** add `--color-surface-raised` to the new set, or accept the flattening. Affects most measurement screens (dashboard, bench, leaderboard all use banded layouts).

**4.2 — No progress-track token.** Blind Fifty Status renders coverage progress toward the ≥40 judgment gate (`reconciliation.spec` #5, INVARIANT). It needs a track colour. **Fix:** add `--color-track`.

**4.3 — `--color-ink-dim` must not map to `--color-ink-muted`.** The new muted token fails WCAG AA (3.28:1 on white, 2.65:1 on app — see `component-inventory.md` §4.6). Old `--color-ink-dim` `#8a857a` carries real text on these screens. Mapping it to a failing token would *introduce* an accessibility regression during a re-platform. Map to `--color-ink-secondary` until the muted-token decision lands.

**4.4 — No neutral/slate family.** Old `--color-neutral*` marks idle and abandoned states — used by the dashboard's third bar segment and by delivery/complaint idle rows. The new palette has no neutral except one chip background. **Fix:** add `--color-state-idle{,-border,-surface}`. This is a real semantic, not decoration: "nothing is happening here" is distinct from "settled".

**4.5 — Serif.** Do the re-platformed screens adopt `--font-quote` for quoted human text? Consistent with the new design, but a visual change to screens the decision says to keep. **Recommend yes** — it is the same rule applied to the same content type, and these screens are full of exactly that content. Confirm.

**4.6 — Two animations to port.** `hlpulse` (highlight arrival) and `railpulse` (unresolved-complaint ACT dot, *"one slow, low-opacity red ring… amber attention dots stay still"*). The new set has only `tp-pulse`. Both old ones are semantic and `railpulse` is pinned by `sidebar.spec` #2 (INVARIANT — red for a complaint, amber for a gap). **Fix:** port both into `tokens.css`.

---

## 5. Consequences for Pass 1

The deletion list changes.

- **Nothing is out of scope.** All 126 harvested specs stay; the completion bar is unchanged at 132 (126 + 6 keyboard specs now INVARIANT per `open-rulings.md` Q3).
- **The 12 screens' current implementations are reference material** until their replacements land. Deleting them loses nothing permanent — the `.dc.html` pixel spec is archived and git holds the React — but there is no reason to delete them early. **Recommend: delete them in Pass 3, screen by screen, as each replacement lands.** The Pass 1 deletion commit then covers only the 4 screens the new design replaces (Queue, Review, Ingest→Upload, plus the account/rulebook surfaces), the shared chrome, and the old theme.
- That keeps the deletion commit legible as "removed the old reviewer UI" and avoids a long window where 12 screens are deleted but not yet rebuilt.

**Still blocking Pass 1:** the escalation-rule ruling (Q11) and the dark-pane decision (§2). Everything else is answerable as I build.
