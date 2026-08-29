# Product invariants — the refusals, written down

**Status: authoritative requirements. Not a test file, not a design note.**

Harvested 2026-08-26 from `apps/web-v2/e2e/invariants/` (96 specs) immediately before that
tree was deleted for the second frontend rebuild. Those specs were themselves a harvest,
migrated from `apps/web` at commit `ade49af`. This document exists so a **third** harvest is
never needed: the rules now live in `docs/`, where a frontend rebuild cannot reach them.

## Why this file exists

The deleted `e2e/invariants/README.md` carried this warning:

> `ORPHAN RULE` — asserts a rule written down **nowhere else in this repository**.
> Deleting one of these deletes the rule. 16 of them.

Twelve such rules were still live at deletion and are marked **`ORPHAN`** below. For those,
this document is now the only record. Everything else here restates a rule that also appears
in `docs/CONTEXT.md`, `docs/PRD.md`, `docs/HANDOFF.md`, or the rulebook — but restates it as
an *observable behaviour*, which is the form a rebuild can actually be checked against.

## How to use it

- These are **acceptance criteria for any TitlePipe frontend**, current or future.
- Selectors, markup, framework and visual language are all disposable. **The assertions are not.**
- If a rule cannot be satisfied by a proposed design, that is a **`CONFLICT` in the design**,
  not a stale requirement. Stop and report it. Do not weaken the rule to fit the screen.
- Root `CLAUDE.md` states the same thing as a hard rule: *"Refusals are product requirements →
  Playwright tests."* When the rebuild's test suite exists, every line below should map to one.

---

## 1. Server owns all state

1. The server owns `state`. **Engine confidence never promotes or demotes a field** — 0.99
   stays queued, 0.01 stays confirmed.
2. `pending` + `null` renders as **"not yet extracted"** — never "Not Available", never queued.
3. **`needs_review` is NEVER derived from `value === null`.**
4. The server's returned state is what renders. **Never an optimistic local mutation.**
5. The UI never re-derives counts, chain termination, or release resolution.
6. The order strip **prints the server's stamp — it does not compose one.**

## 2. The two NA states

7. `NOT_PRESENT` and `PRESENT_UNREADABLE` are **never collapsed**, and `pending` is a distinct
   third render that never reads as either.
8. A value with **no provenance renders as a visible hard error** — never a blank, never a
   bare value. (Root `CLAUDE.md` principle 6: never emit a value you can't cite.)

## 3. Refusals must speak

9. A **correction is refused without its reason.**
10. An **escalation is refused without its question.**
11. A **pass is refused without its reason**, and Escape keeps the order. **`ORPHAN`**
12. **Every refusal speaks** — escalate, correct and pass each nudge with what is missing.
    **A silent no-op is the defect.** **`ORPHAN`**
13. The queue's pass refusal nudges too. **`ORPHAN`**
14. A refused mutation surfaces **the server's message verbatim** — the client never authors
    the refusal text.
15. `§4.3` — an incomplete upload renders **the server's missing-field list verbatim**; the
    client does not author the list.

## 4. Conflicts are answers, not no-ops

16. A **409 is an ANSWER**: the server's message surfaces verbatim, **selection never
    advances**, and the field repaints as the server has it.
17. A terminal-state 409 is answered the same way — surfaced, not swallowed.
18. Confirm is **idempotent on an identical value (200/200)** and **conflicts on a different
    one (409)**.
19. A **replayed resolution is refused (409)** — resolution is not idempotent-repeatable.

## 5. One act files one record

20. Three clicks on a correction submit file **exactly one correction** — including three
    clicks within a single tick.
21. Repeated Enter on an exclude files **exactly one suppression**.
    *(Rationale from the deleted spec: three reason rows for one reviewer act, in the table
    that feeds the rule channel.)*

## 6. The queue refuses browsing

22. The queue is a **single server-chosen next order** — no list, no browsing, **no
    cherry-picking**.
23. **No pace indicators, no throughput language, no timers, and no time ESTIMATES** — an
    estimate is a pace indicator.
24. A reasoned pass records and **the server** serves the next order.
25. Enter starts review on the **served** order.

## 7. Review workstation

26. **No approve-all. No throughput. No timers.** Anywhere.
27. Field navigation visits **ONLY server-queued fields** — a reviewer cannot walk into
    auto-confirmed fields. *(ORPHAN O20, promoted to INVARIANT by open-rulings Q3.)*
28. Engine disagreement is surfaced **on the row**, and both readings shown **attributed** in
    the panel.
29. When both engines found a value and disagree, the UI **must never claim extraction
    returned nothing**. The draft leads, labelled as a draft. **`ORPHAN`**
30. The **differing characters** between two readings are highlighted, so the reviewer sees
    *where* they diverge. **`ORPHAN`**
31. A reading can be **adopted into the correction editor without retyping** — transcription
    is a defect source. **`ORPHAN`**
32. A correction is **inert until it differs** from the machine read.
33. Provenance coordinates render as a **pin on the source page raster**.
34. The coverage spine renders **one cell per package page**, not just read ones.
35. Review shows the intake signature **as a record, with no way to edit it**.

## 8. Escalations

36. `§0.5 MANDATORY` — **escalation resolution is REFUSED without a rule.** A ruling alone is
    not a resolution.
37. Citing an existing rule is **one of exactly two** resolution paths.
38. A drafted rule lands **PENDING and renders visibly inert** — it cannot affect the pipeline
    until an engineer confirms.
39. The escalation inbox has **no triage furniture** — no category, no priority, no assignee.
    Just the rule. **`ORPHAN`**

## 9. Authorization

40. The **role gate runs BEFORE validation** — a role lacking the action gets 403 even with an
    invalid body.
41. **One permission table** gates UI affordances and server mutations alike — they cannot drift.
42. A role-locked affordance is **ABSENT, not disabled.**
43. Doors outside the role's world are **ABSENT, not dimmed.**
44. A **forged or case-variant role is refused** — roles are exact, and garbage never yields
    the admin world.
45. Nobody signed in is shown an ADMIN world; the session-ended screen is equally bare.
46. The capture seat has **no rail** — structural blindness stays whole.

## 10. Ingest

47. **Acceptance is explicit** — an upload alone never queues an order.
48. A duplicate package surfaces the server's **sha256-match notice**.

## 11. Keyboard

49. **Keys typed inside an input are TEXT, never chords.** Typing a correction must never
    trigger navigation.
50. A screen's keys are **pane-local**: the innermost layer that can use a key wins, and a
    focused control owns the keystroke — the screen shortcut stands down and does not
    suppress the default.
51. A **chord's second key must never ALSO fire a screen action.** This is what stops a stray
    keystroke destroying an in-progress correction. **`ORPHAN`** *(O15)*
52. The **key map is modal**: it swallows screen keys while open and restores them on Escape.
    **`ORPHAN`**
53. The key map is a **real dialog** — accessible name, focus moves into it, focus is trapped,
    and closing returns focus where it came from. A cheat sheet that fires the commands it
    describes is the trap it claims not to be.
54. Keyboard **is** the navigation layer; `?` renders the map.

## 12. Deep links and order identity

55. Deep links are first-class — **`?field=` lands on the exact field in context** (URL-owned
    selection).
56. The order's states **travel with it** — the spine shows queue, escalation and delivery
    state together.

## 13. Errors degrade locally

57. An unknown route renders a **named not-found state, never a blank page**. **`ORPHAN`**
58. A failed list query renders a **named unavailable state**. **`ORPHAN`**
59. A partial failure **degrades that region only** — the order spine still renders its
    identity. **`ORPHAN`**

## 14. Frame and layout

60. **The app is ONE FRAME**: rooted at `height:100vh; overflow:hidden`, scrolling only the
    screen body, so the rail, the order strip and every docked bar stay put.
61. `main` **fills the content column** rather than shrink-wrapping. The binding constraint is
    the **container**, not the window — no viewport-width guard catches this.
62. The order strip stays put while the screen scrolls under it.
63. The rail is a **full-height column**, not a page-sticky element.
64. **Nothing collapses below its own content.**
65. **The page never scrolls sideways at any supported width.**
66. Attention rides the doors as **dots, never counts**.

## 15. Preferences

67. Collapse is a **persisted UI preference** stored **server-side** (`GET/PATCH
    /api/me/preferences`, decision C16) — **never `localStorage`**, which `§9.11` forbids.
68. Nothing goes in `localStorage` or `sessionStorage`.

---

## Not carried forward

Five specs were dropped from the previous harvest as **`STRUCTURAL`** — they asserted the old
UI's layout with no rule behind them. They remain in git at `ade49af`.

The full deleted suite remains recoverable on `main` and at the pre-deletion commit on
`rahuldr07/frontend-rebuild`. Selector-level detail and the reasoning behind each spec live
there; this file carries the rules those selectors were protecting.
