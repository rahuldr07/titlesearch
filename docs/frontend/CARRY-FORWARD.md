# Carry-forward — what survived the 2026-08-27 cleanup

**Status: authoritative. Written 2026-08-27**, immediately before ~21 documents describing
the deleted `apps/web-v2` build and the superseded 2026-07 design were removed.

Those documents are recoverable from git history. This file exists because a fact that
lives only in git history is a fact nobody will find. Everything below cost real time to
learn, was verified against a running build, and **still binds against the 2026-08 design
and the react-aria stack** — so it is restated here rather than left to archaeology.

Deleted sources are cited by name so the original can be recovered if the detail matters.

---

## 1. Constraints on the rebuild

**The rule picker on the escalation screen must stay a native `<select>`.**
Playwright's `selectOption` only drives native selects. *(was `HANDOFF-UI.md` §7)*

This survives the react-aria decision and is the reason the design's one `combobox` role
does not force a library choice — see
`docs/superpowers/specs/2026-08-27-frontend-dependency-set-design.md`.

**Behaviour already earned — do not regress it** *(was `HANDOFF-UI.md` §7)*:

- `DestructiveConfirm` moves focus when it arms.
- `RequiredComment` keeps its submit **enabled** and explains the refusal on click. A
  disabled submit cannot tell you why — this is the same principle as design rule 9.
- The NA renders must survive greyscale. Colour is never the only signal.

---

## 2. Traps that cost real time

Each is a measured symptom, not a caution.

**Tailwind v4 `@theme` namespaces are not uniform.** `--space-*`, `--z-*` and `--filter-*`
generate **no utilities at all**; `--stroke-*` generates the wrong property (SVG `stroke:`).
*Symptom: a token exists and the class does nothing.* **Always grep the built CSS to
confirm a utility emits.**

This one is live for the new design. `design-2026-08/tokens.css` is plain custom
properties, so how they are wired into `@theme` is an open decision, and this is the trap
waiting there.

**The spacing base was 2px, which made `max-w-400` mean 800px.** The app shell was capped
at `max-w-400` and starved every wide screen — a seven-column board overflowed by 426px
with two columns hidden behind a scrollbar that had no affordance, **at every window
size**. *Symptom: content truncated identically at all viewport widths.* A viewport-based
guard will not catch this; the binding constraint is the **container**. Whatever base the
new token wiring picks, write it down and test one wide screen against it.

**`cn` needs its `extendTailwindMerge` config.** Without it `tailwind-merge` does not know
custom scales and silently drops the earlier class — `cn("text-micro", "text-ink-muted")`
returned only the colour, killing the font size on every eyebrow in the app. *Symptom: a
size class you wrote has no effect.* `tailwind-merge` is still in the manifest; this still
applies.

**A CSS `text-transform` does not change what text says.** Where a test or the design needs
literal capitals, write them in the markup. Design rule 4 mandates ALL-CAPS for sidebar
rubrics and serif certificate headings — write those as capitals, not as `uppercase`.

**`doorsFor` treats a path with NO authz row as OPEN.** The authz table lists the screens
whose access is *restricted*, not every screen that exists. Reading a missing row as a
refusal hid the entire order flow from everyone and silently killed the keyboard chords.

*(all five were `HANDOFF-UI.md` §6)*

---

## 3. Keyboard

**`react-hotkeys-hook` does not recognise `?` or `[` as hotkey names.** Both were
registered and never fired; they had to be matched on the character with an explicit
keydown listener plus a hand-written input guard. *Symptom: a shortcut that demonstrably
does nothing, with no error.* *(was `HANDOFF-UI.md` §6)*

**Resolved by replacement.** The 2026-08-27 dependency spec replaces `react-hotkeys-hook`
with `tinykeys`, which was verified to bind `?`, `[`, `Shift+/` and the `g h` sequence.
This entry is kept because it is the evidence behind that choice.

---

## 4. Dead facts, recorded so they are not rediscovered

**The Base UI package rename.** `@base-ui-components/react` was renamed to `@base-ui/react`
as a breaking change in v1.0.0; the old name is frozen at `1.0.0-rc.0` and never shipped a
stable release. This repo installed the dead name once and lost time to it.
*(was `phase2-audit.md` §5)*

No longer load-bearing — the rebuild selects react-aria-components — but it remains the
worked example of why a renamed package poisons agent recall, which is an argument the
dependency spec relies on.

**`Menu.GroupLabel` without a `MenuGroup` ancestor threw synchronously** and unmounted the
whole app chrome, invisible until someone opened the console. *(was `HANDOFF-UI.md` §6)*
Base UI specific, so dead on the new stack — kept as the reason "a library-caused defect
can be silent" is not a hypothetical here.

---

## 5. What was NOT deleted, and where to look instead

| Still live | Why |
|---|---|
| `docs/INVARIANTS.md` | The rulebook. Exists so rules survive exactly this kind of cleanup. |
| `docs/frontend/decisions.md` | Owner rulings. |
| `docs/frontend/open-rulings.md` | **Q11 is unresolved and referenced by the 2026-08 design analysis.** |
| `docs/frontend/test-harvest.md` | The harvest record behind `INVARIANTS.md`. |
| `docs/frontend/design-2026-08/` | The current design, its tokens, and its three analyses. |
| `docs/superpowers/specs/2026-08-27-frontend-dependency-set-design.md` | The current dependency set. |
