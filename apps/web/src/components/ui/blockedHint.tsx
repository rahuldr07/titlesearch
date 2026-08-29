import type { ReactNode } from "react";

/**
 * ══ REACT ARIA SILENTLY EATS `title`, AND THE STORIES CAUGHT IT ══════════════
 *
 * MEASURED 2026-08-27, not assumed. `disabled.ts` returns `title` alongside
 * `data-disabled-reason`, and every composite in this kit spreads both. Only
 * one of them arrives. React Aria runs props through `filterDOMProps`, whose
 * allowlist carries `data-*` and the labelable set but NOT `title`, so a
 * blocked Checkbox rendered as
 *
 *   <label data-slot="checkbox" data-disabled-reason="…" class="…">
 *
 * with the attribute simply absent. `data-disabled-reason` survived, which
 * means `e2e/invariants` stayed green while the HOVER HALF of rule 9 was gone
 * from every composite control in the app. Type-clean, lint-clean, gate-clean,
 * and wrong — the exact failure family `disabled.ts` was written to stop, one
 * layer below where it was looking.
 *
 * Native elements (`<button>`, `<input>`) keep their `title` — the stripping
 * is a composite problem, which is why it went unnoticed: the Button kept
 * working. But "unaffected" oversold it, and REVIEW-03 B1 is the correction:
 * a native wrapper needs the NATIVE prop too. react-aria's `Input` reads
 * `disabled`, not `isDisabled`, so a "blocked" Input handed the composite
 * spelling rendered its reason faithfully while staying fully editable —
 * `disabled.ts` splits the two spellings (`disabledNativeAttributes`), and
 * `input.blocked.stories.tsx` types at the real element to prove it.
 *
 * ══ WHY A WRAPPER AND NOT A PATCH TO disabled.ts ═════════════════════════════
 *
 * `disabled.ts` is shared and its contract — a reason expands into DOM props —
 * is right. The defect is not in the expansion, it is that one consumer drops
 * one prop. So the repair sits at the render site of the controls that have the
 * problem, and it renders NOTHING when the control is live: an enabled control
 * gains no wrapper node, no `title`, and no stray native tooltip shadowing a
 * real one.
 *
 * `display: contents` (`contents` below) keeps the wrapper out of layout
 * entirely — the flex/grid parent still sees the control as its own child — so
 * a `<span>` appearing around a blocked control cannot move it.
 *
 * NOT `aria-describedby`: the reason is already on the control's accessible
 * description path via the field's own note, and a second announcement would
 * read the sentence twice. This is the POINTER affordance specifically. A
 * tooltip alone fails WCAG 2.2 on touch, which is why it is the third carrier
 * and never the only one.
 */
export function BlockedHint({
  reason,
  children,
}: {
  readonly reason: string | null | undefined;
  readonly children: ReactNode;
}) {
  const blocked = typeof reason === "string" && reason.length > 0;
  if (!blocked) return <>{children}</>;

  return (
    <span className="contents" title={reason}>
      {children}
    </span>
  );
}
