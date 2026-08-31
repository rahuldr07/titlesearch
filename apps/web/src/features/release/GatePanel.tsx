import type { GateCheck } from "@titlepipe/contract";
import { StatusMark } from "../../components/ui";

/**
 * The server's gate verdicts. `GateCheck.passed` is read and rendered —
 * nothing here evaluates a gate, counts the open ones, or infers a pass from
 * the absence of a `detail`.
 */
export function GatePanel(props: { readonly gates: readonly GateCheck[] }) {
  return (
    <section
      data-testid="gate-panel"
      aria-labelledby="gate-panel-title"
      className="flex shrink-0 flex-col gap-6 border-t border-line-strong bg-surface-sunken p-10"
    >
      <h2
        id="gate-panel-title"
        className="font-sans text-label leading-flat font-bold text-ink-muted"
      >
        Release gate verification
      </h2>
      <ul className="flex flex-col gap-6">
        {props.gates.map((gate) => (
          <li
            key={gate.id}
            data-testid={`gate-${gate.id}`}
            data-passed={gate.passed}
            className="flex flex-col gap-2"
          >
            <StatusMark
              mark={gate.passed ? "settled" : "halt"}
              label={gate.label}
              className="items-start"
            />
            {gate.detail !== null && (
              /* The server's own words for what is outstanding, unedited. */
              <span className="pl-8 font-sans text-label leading-body text-ink-secondary">
                {gate.detail}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
