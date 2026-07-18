import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { session, useSession } from "../session";
import { canAccess } from "../nav";

/**
 * Keyboard as navigation: `g` then a key jumps between screens; `?` shows
 * the map. A reviewer completes a shift without touching the mouse except to
 * zoom a scan. Sequences are swallowed in the capture phase so a pending `g`
 * never leaks its second key into a screen's single-key actions; everything
 * suspends inside form fields.
 */
const GO: Record<string, { to: string; label: string }> = {
  q: { to: "/queue", label: "queue" },
  d: { to: "/dashboard", label: "readout" },
  i: { to: "/ingest", label: "ingest" },
  e: { to: "/escalations", label: "escalation inbox" },
  v: { to: "/delivery", label: "delivery" },
  c: { to: "/complaints", label: "complaints" },
  o: { to: "/golden", label: "golden set" },
  b: { to: "/bench", label: "extraction bench" },
  r: { to: "/bench/results", label: "bench results" },
  l: { to: "/leaderboard", label: "engine leaderboard" },
  s: { to: "/blind-status", label: "blind fifty status" },
  a: { to: "/account", label: "account" },
};

function inFormField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

export function GlobalKeys() {
  const navigate = useNavigate();
  // reactive for the overlay's chord map; the keydown handler reads the
  // `session` proxy at event time — both views of the same store
  const role = useSession((s) => s.role);
  const [pendingG, setPendingG] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const onKey = (e: KeyboardEvent) => {
      // typists see only the capture screen (§0.7) — no map, no jumps
      if (window.location.pathname.startsWith("/blind/")) return;
      if (inFormField(e.target)) return;
      if (e.key === "?") {
        e.preventDefault();
        e.stopPropagation();
        setShowHelp((s) => !s);
        return;
      }
      if (e.key === "Escape" && showHelp) {
        setShowHelp(false);
        return;
      }
      if (pendingG) {
        const dest = GO[e.key.toLowerCase()];
        // swallow the second key either way — it belongs to the sequence
        e.preventDefault();
        e.stopPropagation();
        setPendingG(false);
        if (timer !== undefined) window.clearTimeout(timer);
        // chords respect the role's world (nav.ts): a door that doesn't
        // exist can't be jumped to either
        if (dest && canAccess(session.role, dest.to)) {
          void navigate({ to: dest.to });
        }
        return;
      }
      if (e.key.toLowerCase() === "g" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setPendingG(true);
        timer = window.setTimeout(() => setPendingG(false), 1200);
      }
    };
    // capture phase: the sequence's second key must never reach screen hotkeys
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [pendingG, showHelp, navigate]);

  return (
    <>
      {pendingG && (
        <div className="fixed bottom-3 left-3 z-[60] rounded-btn border border-line-strong bg-surface px-3 py-1 font-mono text-[11.5px] text-ink-secondary shadow-pop">
          g …
        </div>
      )}
      {showHelp && (
        <>
          <div
            onClick={() => setShowHelp(false)}
            className="fixed inset-0 z-[70] bg-[rgb(31_28_23/0.25)]"
          />
          <div
            data-testid="key-map"
            className="fixed top-1/2 left-1/2 z-[71] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-card border border-line-strong bg-card px-6 py-5 shadow-pop"
          >
            <div className="flex items-baseline justify-between">
              <div className="text-[12px] font-bold tracking-[.1em] text-label">
                THE MAP — KEYBOARD AS NAVIGATION
              </div>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="cursor-pointer border-none bg-transparent px-1 text-[14px] text-ink-dim"
              >
                ×
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-[6px] text-[12px]">
              {Object.entries(GO)
                .filter(([, v]) => canAccess(role, v.to))
                .map(([k, v]) => (
                  <div key={k} className="flex items-baseline gap-2">
                    <b className="rounded-chip border border-line-strong bg-line-light px-[5px] font-mono">
                      g {k}
                    </b>
                    <span className="text-ink-secondary">{v.label}</span>
                  </div>
                ))}
            </div>
            <div className="mt-4 border-t border-hairline pt-3 text-[11.5px] leading-[1.6] text-ink-dim">
              On Review: <b>J/K</b> next/prev queued · <b>⏎</b> confirm ·{" "}
              <b>C</b> correct · <b>E</b> escalate · <b>B</b> pipeline bug ·{" "}
              <b>S</b> re-centre source · <b>P</b> pass. Seed Correction has no
              key and no menu — it opens only from a failing bench cell.
            </div>
          </div>
        </>
      )}
    </>
  );
}
