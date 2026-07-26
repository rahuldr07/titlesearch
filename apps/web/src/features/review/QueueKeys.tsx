import type { Field } from "@titlepipe/contract";
import { useEffect } from "react";
import { isTypingTarget } from "./keys";

/**
 * J / K movement through the review queue. Renders nothing.
 *
 * WALKS ONLY THE FIELDS THE SERVER QUEUED (orphan rule O20). It does not range
 * over the whole report: a reviewer cannot use J/K to wander into
 * auto-confirmed or already-settled fields and re-open them. That is the
 * anti-cherry-picking rule applied at field granularity — the server decides
 * what is yours, and this only moves within that.
 *
 * The list arrives in the server's order and is walked in it. No sort, no rank.
 */
export function QueueKeys({
  queued,
  selectedPath,
  onSelect,
}: {
  queued: readonly Field[];
  selectedPath: string | undefined;
  onSelect: (path: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return; // O15 — typed text is text
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const step = k === "j" || e.key === "ArrowDown" ? 1 : k === "k" || e.key === "ArrowUp" ? -1 : 0;
      if (step === 0) return;
      e.preventDefault();
      if (queued.length === 0) return;
      const here = queued.findIndex((f) => f.path === selectedPath);
      // an unqueued field is selected (arrived by deep link) — J enters the
      // queue at the top rather than doing nothing
      const next = here === -1 ? 0 : here + step;
      const target = queued[Math.max(0, Math.min(queued.length - 1, next))];
      if (target !== undefined && target.path !== selectedPath) {
        onSelect(target.path);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queued, selectedPath, onSelect]);

  return null;
}
