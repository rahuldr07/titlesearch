# ADR-0002 — double-click edits are not gated to the queue

**Status:** ACCEPTED — **RULED 2026-09-08**
**Date:** found 2026-09-06 · ruled 2026-09-08
**Deciders:** rahuldr07 (owner)

## Context

`onSelect` refuses a row that `canSelect` rejects, and `J`/`K` walk queued fields
only. `beginEdit` consults neither. A field like `owner.property_address` — which
is `auto_confirmed`, and which a single click will not even select — can be
double-clicked to open a write surface, and the edit path *grants the very
selection the click path refused*.

Found while writing the PATH B invariant. A test pinning the behaviour existed
before this ruling and was green **because it pinned the defect**.

## Decision

**The asymmetry is deliberate and stays.** Double-click is the override for
correcting a field the pipeline has already settled; an `auto_confirmed` misread
has no other route onto the workstation.

## Rejected alternative

`beginEdit` consulting `canSelect` the way `onSelect` does. That closes the only
way onto a settled field. The two checks disagreeing is therefore the design, not
a missed guard — which is exactly why it needs to be written down: read from the
code alone, it looks like an oversight, and the obvious "fix" would silently
remove the only correction path for a settled misread.

## Scope — read this before extending it

**The ruling covers reachability only.** It says a double-click may *reach* the
editor. It does not exempt the correction from anything the click path enforces;
what a filed correction must carry is ruled separately (`editorHold.ts`).

## The machine

Pinned by `"PATH B (double-click) — the ruled override opens a write surface on
an auto-confirmed row"` in `apps/web/e2e/invariants/review.spec.ts`. That test
now pins the ruling rather than the defect. If it goes red, either the override
was closed by accident or this ADR was superseded — check which before repairing.
