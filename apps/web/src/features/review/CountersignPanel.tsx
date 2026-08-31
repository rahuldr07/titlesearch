import { useState } from "react";
import { TextField } from "react-aria-components";
import { Alert, Input, Label } from "../../components/ui";
import { useRead } from "../../app/useRead";
import { QueryState } from "../../entities/state/QueryState";
import { countersigns } from "../../shared/countersignQueries";
import { useCountersign } from "./useCountersign";
import { CountersignRow } from "./CountersignRow";
import { CountersignSettled } from "./CountersignSettled";
import { SwitchExaminer } from "./SwitchExaminer";

/**
 * Second read — T1 exposure: the ruinous-exposure rulings this order
 * carries and the countersign each one still needs, drawn from
 * `GET /api/orders/{id}/countersigns` and from nothing else. The
 * different-examiner rule is the server's 409, so the action is never
 * dimmed by who is signed in; the one hold is the signature the request
 * cannot be made without. One act files one record: a button filing three
 * second reads on one press would be approve-all wearing a different hat,
 * so each ruling is countersigned on its own row, against one signature.
 */
export function CountersignPanel(props: { readonly orderId: string }) {
  const query = useRead(countersigns(props.orderId));
  const writes = useCountersign(props.orderId);
  const [signature, setSignature] = useState("");

  const held = writes.pending
    ? "Filing the countersign…"
    : signature.trim() === ""
      ? "A countersign is refused without a signature."
      : null;

  return (
    <QueryState query={query} of="this order's T1 second read">
      {(data) => {
        const outstanding = data.required.filter(
          (entry) => entry.countersigned_by === null,
        );
        if (outstanding.length === 0) {
          return <CountersignSettled required={data.required} />;
        }

        return (
          <div
            data-testid="countersign-panel"
            className="rounded-r-lg border-l-4 border-l-action bg-action-surface p-9"
          >
            <div className="flex items-baseline justify-between gap-6">
              <h2 className="text-body leading-tight font-bold text-ink-primary">
                Second read — T1 exposure
              </h2>
              {/* The list length is what arrived; nothing here counts anything. */}
              <span className="font-mono text-label leading-flat font-bold text-action">
                {outstanding.length === 1 ? "1 ruling" : `${outstanding.length} rulings`}
              </span>
            </div>

            <p className="mt-2 text-meta leading-body text-ink-secondary">
              These ruinous-exposure (T1) rulings need a second examiner&rsquo;s
              countersign before the report can compose — no single-examiner release.
            </p>

            <ul className="mt-6 flex flex-col gap-3">
              {data.required.map((entry) => (
                <CountersignRow
                  key={entry.field_id}
                  entry={entry}
                  heldBecause={held}
                  onCountersign={() => writes.countersign(entry.field_id, signature)}
                />
              ))}
            </ul>

            <div className="mt-7 flex flex-wrap items-end gap-8">
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <Label htmlFor="countersign-signature">
                  Sign as the second reader — your name goes on the countersign
                </Label>
                <TextField
                  aria-label="Sign as the second reader"
                  value={signature}
                  onChange={setSignature}
                >
                  <Input
                    id="countersign-signature"
                    data-testid="countersign-signature"
                    placeholder="Full name, as it should appear"
                  />
                </TextField>
              </div>
              <SwitchExaminer />
            </div>

            {/* The hold speaks in place, not only on hover. */}
            {held !== null && (
              <p className="mt-4 text-meta leading-body text-state-attend">{held}</p>
            )}

            <p className="mt-4 max-w-180 text-label leading-body text-ink-faint">
              A countersign is refused when it comes from the examiner who ruled. The
              server decides that — this screen sends the act and shows the answer.
            </p>

            {writes.serverNote !== null && (
              <div data-testid="countersign-refusal" className="mt-6">
                <Alert
                  tone="halt"
                  title="The server answered"
                  message={writes.serverNote}
                />
              </div>
            )}
          </div>
        );
      }}
    </QueryState>
  );
}
