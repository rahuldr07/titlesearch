# CONFLICT — the reference app draws no queue, no profile popover, no rail fold

Status: **OPEN — owner's call.** Raised 2026-08-28, during the fidelity rebuild.

The owner's ruling is that `docs/frontend/design-2026-08/reference-app.html` is
the source of truth, and that screens the reference app does not draw should be
deleted. That ruling has now removed behaviour which frozen Playwright specs
assert. This file records exactly what, so the decision is visible rather than
discovered later from a red suite.

The original brief said: *"Never edit an invariant or weaken a test assertion; if
a screen cannot be built without it, that is a CONFLICT in the design, so stop
and write it up."* Nothing below has been weakened or deleted. Three groups.

---

## 1. `/queue` — deleted, and its specs describe product behaviour, not a screen

`src/features/queue/` was deleted because the reference app has no Queue screen;
its rail entry is All Orders, which we built. But two spec files survive it:

- `e2e/invariants/queue.spec.ts`
- `e2e/invariants/queue-keys.spec.ts`

Between them they pin nine behaviours, encoding **INVARIANTS 22–25**:

| Assertion | What it protects |
|---|---|
| renders the server's next order verbatim — exactly one order, no list | 22 — no browsing |
| pass without a reason is refused; esc keeps the order | 24 — a reasoned pass |
| pass with a reason records and advances to the next order | 25 — the hand-over |
| enter starts review on the served order | 27 — cursor visits only queued |
| no pace indicators or throughput language renders | 23 |
| Enter on a rail door opens THAT door, never the served order | keyboard scoping |
| Enter on the pass button opens the reason, never review | keyboard scoping |
| `p` while a control holds focus is the control's key | chord suppression |
| Enter on the focused rail toggle folds the navigator | see group 3 |

**The substance at stake.** INVARIANT 22 is *"the queue is a single
server-chosen next order — no list, no browsing, no cherry-picking."* All Orders
is a browse table. It is the opposite affordance. Replacing the queue with it
does not relocate that invariant; it removes the surface that enforced it, and
the repo's anti-pattern list names *"no queue cherry-picking"* explicitly.

This may well be right — the reference app is a later design than the invariant
list, and the owner may have decided the served-order model is gone. But it is a
**product decision**, not a screen deletion, and nothing in the reference app
states it. It needs saying out loud.

**Not done, pending the ruling:** the two spec files are left in place and
failing. Deleting them would erase the record of a decision nobody made.

**If the answer is "the queue stays":** `git revert` the deletion commit,
*"Delete the nine screens the reference app does not draw"*, and restore the
`/queue` door. Nothing else built since depends on its absence.

---

## 2. The profile popover — the specs describe a design we are not building

`e2e/invariants/shell-frame.spec.ts` asserts a rail account menu that opens a
**popover card**:

- `account-menu` (trigger) → `profile-card` (popover)
- `theme-toggle` inside it, flipping `<html data-theme>` to `mocha`
- a `menuitem` named "Audit" navigating to `/audit`
- Escape dismisses; navigation dismisses; a toggle inside does **not** dismiss

**The reference app draws none of this.** Its rail footer (offset ~31700) is a
flat block, not a menu: initials avatar, name, email, a role pill, a role hint,
and two buttons — "Switch user / Sign out" and "↺ Reset". No trigger, no
popover, no theme control, no audit item.

`src/app/chrome/ProfileBlock.tsx` matches the reference app's block, and now
carries the role hint too. So the screen is right and the specs are pointed at
the previous design (`docs/archive/Title report review tool.zip` → `.dc.html`),
which the ruling superseded.

Two of the three assertions are also independently unbuildable today:

- **`theme-toggle`** — `Preferences.theme` (`packages/contract/src/intake.ts`)
  exists and `PATCH /api/me/preferences` accepts it, so this one *is* buildable.
  It is simply not in the reference app.
- **`/audit`** — no such route, and no door in the reference app's rail. The
  audit trail is the order-scoped `historyOrder` overlay, which is now built as
  `features/overlays/OrderHistoryOverlay.tsx`.

**Not done, pending the ruling:** the popover is not built and the specs are not
edited.

---

## 3. The rail fold — the contract is ready, the design has no control

`e2e/invariants/sidebar.spec.ts` asserts `rail-toggle` folds the rail, that the
fold survives a reload via the **server** preference, and that it is reversible.

- `Preferences.nav_collapsed` exists (`packages/contract/src/intake.ts`), is
  `boolean | null` so "never chosen" is representable, and is marked
  *"⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30)"*.
- `GET`/`PATCH /api/me/preferences` are both live in `packages/mocks`.
- `SideRail.tsx` passes `collapsed={false}` and a named no-op, `NOT_WIRED`.

**The comment on `NOT_WIRED` is factually wrong.** It reads *"The fold has no
server to write to yet"* — but the endpoint has existed for some time. The fold
is unbuilt for a different reason, and the comment should say so.

**The actual reason it stays unbuilt:** the reference app's rail has no fold
control. Building one would be inventing an affordance, and `nav_collapsed` is
still unratified, so the preference it would write is itself provisional.

**Not done, pending the ruling:** the fold is not built; `NOT_WIRED`'s comment
is left uncorrected here because a wrong comment is a smaller defect than a
silent edit to the file this document is about. Fix it with the ruling.

---

## What was repaired, and what it measured

Eight spec files referenced `/queue`, `/completeness` or `/rulebook` only to
*stand somewhere* while testing the rail, the frame, the overlays or the
responsive layout — the route was scenery, not subject. `/completeness` and
`/rulebook` have never had routes in this app at all.

Repointed, with **no assertion changed**:

| Was | Now | Why |
|---|---|---|
| `goto("/queue")` (six files) | `/orders/ord_demo_1` | renders both the rail and the order strip |
| `rail-door-/queue` | `rail-door-/orders-list` | the door that replaced it |
| `responsive-frame` `ROUTES` | `/`, review, `/escalations`, `/templates` | four routes that exist |
| `shell-frame` `CROWDED` | `/orders-list`, `/escalations` | two genuinely crowded screens |
| `shell-frame` `/rulebook` | `/templates` | any screen with a full-height rail |

**Measured after, on `responsive-frame` + `shell-frame`: 9 pass, 10 fail.**
The ten break down as:

- **7** — the 1360px floor, section 4 above. Every below-floor assertion.
- **2** — the profile popover, section 2 above.
- **1** — `nothing collapses below its own content — the escalation cards`.
  This one is a **real finding the repoint surfaced**, not a spec artefact:
  `mode-cite` in `features/escalations/ResolveCard.tsx` renders 18px around
  22px of content. It is a `RadioGroupItem` from the shared kit
  (`components/ui/radio-group.tsx:64`), dating to 2026-08-27, so it affects
  every radio in the app rather than that card. `overflow` is `visible` and
  nothing is clipped, which is why no screenshot caught it. Left unfixed: a
  4px line-box shortfall in a shared primitive is worth a deliberate change to
  the kit, not a patch on the one screen a spec happened to point at.

---

## 4. `responsive-frame.spec` contradicts the design's stated minimum width

Added 2026-08-28, after measuring.

`e2e/invariants/responsive-frame.spec.ts` asserts *"the page never scrolls
sideways"* at 1440, 1280, **1024 and 900px**. It cannot pass at the last two,
and it should not:

- `apps/web/src/styles.css:60` sets `body { min-width: 1360px }`, citing
  *"Design README §App shell: min width 1360px"*.
- `docs/frontend/design-2026-08/README.md:15` says it: *"Min app width 1360px."*
- **The reference app's own CSS carries `min-width: 1360px`** — it is in the
  export, not just the prose.

So the ruling source of truth states a 1360px floor, and a spec asserts the app
works 460px below it. Both landed 2026-08-27 in the same import; the
contradiction predates this rebuild and neither side is today's work.

Measured now, at HEAD: every screen reports `scrollWidth 1360` against the
narrower viewport at 1024 and 900. That is the declared minimum doing exactly
what it was written to do — not a layout defect, and not something the new
recent-orders table or two-row order strip introduced (the figure is constant
across all twelve screens, which is the signature of a floor rather than of
content).

**Recommendation, not applied:** drop 1024 and 900 from that spec's width list
and keep 1440 and 1280, which sit above the floor and are genuine regression
guards. Not done here, because narrowing a spec's range is exactly the kind of
edit the brief forbids doing unilaterally — *"never weaken a test assertion."*

The same file's `ROUTES` named `/completeness` and `/rulebook`, which have never
had routes in this app, alongside `/queue`. Those three were scenery for a
frame-level assertion, so they were repointed to `/`, `/escalations` and
`/templates`. The width list was left alone.

---

## 5. Keyboard `g`-sequences are asserted and were never built

`e2e/invariants/navigation.spec.ts` asserts `g d` → `/delivered` and `g q` →
`/queue`. Neither destination exists (`/delivery` is ours; `/queue` is deleted),
and `apps/web/src/app/keyboard/keymap.ts` — now the single registry, so this is
readable rather than inferred — installs only `$mod+k`, `/`, `?` and `Escape`.
There are no `g`-sequences in the app at all.

The reference app draws no `g`-sequence affordance either. As with the profile
popover, these specs describe the archived `.dc.html` design.

**Not done, pending the ruling:** no sequences built, no assertions edited.
