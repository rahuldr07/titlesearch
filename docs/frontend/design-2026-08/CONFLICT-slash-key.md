# `CONFLICT` — `/` focuses the All Orders search box vs `/` opens the command palette

**Status: OPEN. Needs an owner ruling. Nothing was changed; the palette binding stands.**
**Raised:** 2026-08-28, auditing `{{ paletteOpen }}` / `{{ shortcutsOpen }}`.
**Governing procedure:** `docs/INVARIANTS.md:26-27` — a design that cannot satisfy a rule is a
conflict in the design, written up rather than quietly resolved by the screen that hit it.

---

## 1. What the design does

`ref-orders.html` @3338 binds `/` on the All Orders screen to **focus that screen's search
box**. `reference-app.html`'s shortcut HUD prints no `/` row at all — the key exists only on
the one screen that has a search box.

## 2. What this app does

`apps/web/src/app/keyboard/keymap.ts` binds `/` **app-wide** to open the command palette, the
same act as `⌘K`. `GlobalKeys` installs it once, at the window, for every screen.

## 3. Why it was not simply changed to match

Three reasons, in decreasing order of weight.

1. **`chord-suppression.spec` rests on it.** Test #5 — "the command palette owns `/` and `?`
   while it is up" — types `?/` into the open palette and asserts the characters land as TEXT,
   no key map appears and the URL does not move. It is one of the two specs in that file that
   currently passes. A `/` that belongs to one screen's input cannot carry that assertion.
2. **A global key that works on one screen in twelve is worse than no key.** The design gets
   away with it because its `/` is *registered on the orders screen only*. Ours is registered
   globally, so making it focus a box would make it silently dead everywhere else — and rule 11
   forbids advertising a cap whose handler does something other than what it says.
3. **The palette reaches the search anyway.** Since `RULING-2026-08-28.md` option C the palette
   lists orders from `GET /api/orders`, so `/` then typing an address is the same journey the
   design's `/` starts, one keystroke longer and available from every screen.

## 4. What a ruling would have to pick between

| Option | Effect | Cost |
|---|---|---|
| **A — keep as built** | `/` opens the palette everywhere. | Diverges from `ref-orders.html` @3338. |
| **B — pane-local `/`** | All Orders installs `/` for its own search box; the global `/` yields to it while that screen is mounted (INVARIANT 50 already permits this: innermost layer wins). | Two rows in the registry with one cap; the shortcut list must then say *where* each fires. `chord-suppression.spec` #5 needs re-pointing at `⌘K`. |
| **C — drop the global `/`** | Only `⌘K` opens the palette; `/` belongs to All Orders. | Loses a one-key palette on eleven screens. |

**B is the design's intent and is buildable** — the section header "In the review workstation"
already proves the shortcut list can say where a key fires. It is not built here because
`src/features/ordersList/**` is another agent's scope and the binding is load-bearing for a
passing spec.

## 5. What was corrected in the meantime

`keymap.ts` carried a stale justification for the global `/`: *"There is no search surface — the
browsable order list it belongs to is a hard conflict."* That was true when written and was
falsified by `RULING-2026-08-28.md`, which authorised the browse endpoint; All Orders and its
search box both exist. The comment now states the real reason and points here.
