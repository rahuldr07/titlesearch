import { Link, useNavigate } from "@tanstack/react-router";
import { useHotkeys } from "react-hotkeys-hook";
import { ScreenFrame, TopBar } from "../components/TopBar";
import { ROLE_HOME } from "../nav";
import { useSession } from "../session";
import { useDoorSignals, type Tone } from "../useDoorSignals";

/**
 * Home — the map, live. "/" is a role-aware hub, not a menu: only the doors
 * in the session role's world render (§0.7 — absent, never dimmed), and each
 * door carries its live attention signal. Amber is the only navigation
 * signal: an open escalation, a delivery stuck in transit, a rule draft
 * waiting at the engineer gate PULL you to their screen; quiet doors recede.
 *
 * What deliberately does NOT appear: order counts beyond the single next
 * (queue browsing ban), accuracy numbers, anything throughput-adjacent.
 * Typists never reach this screen — the index route redirects them straight
 * to their capture seat before it renders.
 */

const toneText: Record<Tone, string> = {
  attend: "font-semibold text-state-attend",
  act: "font-semibold text-state-halt",
  quiet: "text-ink-secondary",
};

export function HomeScreen() {
  const role = useSession((s) => s.role);
  const navigate = useNavigate();
  const { doors, signalOf, anyError } = useDoorSignals();

  useHotkeys(
    "enter",
    () => void navigate({ to: ROLE_HOME[role] }),
    { preventDefault: true },
    [role],
  );

  return (
    <ScreenFrame>
      <TopBar title="TitlePipe — the map, live">
        <div className="text-[12px] text-ink-secondary">
          amber pulls; quiet recedes — go where the attention is
        </div>
      </TopBar>
      <div className="flex-1 overflow-y-auto px-[22px] pt-[22px] pb-[60px]">
        <div className="mx-auto max-w-[1014px]" data-testid="home-hub">
          {anyError != null && (
            <p className="mb-3 text-[13px] text-state-halt">
              Some signals unavailable: {String(anyError)}
            </p>
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
            {doors.map((d) => {
              const sig = signalOf(d.to);
              const hot = sig !== null && sig.tone !== "quiet";
              return (
                <Link
                  key={d.to}
                  to={d.to}
                  data-testid={`door-${d.to}`}
                  className={`block rounded-md bg-surface-panel px-[18px] py-[14px] no-underline ${
                    hot
                      ? sig.tone === "act"
                        ? "border-[1.5px] border-state-halt"
                        : "border-[1.5px] border-state-attend-border"
                      : "border border-line-strong"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11.5px] font-bold tracking-[.1em] text-ink-secondary">
                      {d.label}
                    </span>
                    <b className="rounded-xs border border-line-strong bg-line-subtle px-[5px] font-mono text-[10.5px] text-ink-secondary">
                      g {d.key}
                    </b>
                  </div>
                  {sig !== null && (
                    <div className={`mt-[6px] text-[12.5px] ${toneText[sig.tone]}`}>
                      {sig.text}
                    </div>
                  )}
                  <div className="mt-[5px] text-[11.5px] leading-[1.5] text-ink-secondary">
                    {d.desc}
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-5 text-[12.5px] text-ink-primary">
            <b className="rounded-xs border border-line-strong bg-line-subtle px-[5px] font-mono">
              ⏎
            </b>{" "}
            opens your first door ·{" "}
            <b className="rounded-xs border border-line-strong bg-line-subtle px-[5px] font-mono">
              ?
            </b>{" "}
            shows this map anywhere ·{" "}
            <b className="rounded-xs border border-line-strong bg-line-subtle px-[5px] font-mono">
              g
            </b>{" "}
            then a key jumps — from any screen, without the mouse
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}
