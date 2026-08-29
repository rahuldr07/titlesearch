import type { CreateOrderRequest } from "@titlepipe/contract";
import { TextField } from "react-aria-components";
import { Input } from "../../components/ui";
import { ClientPicker } from "./ClientPicker";
import { MANIFEST } from "./manifest";

/**
 * THE RIGHT COLUMN — "the order: what the PDF cannot say". One row per
 * `CreateOrderRequest` member (endpoints.ts:39), label in mono (rule 3: it
 * names a data key), the reason beside it in prose.
 *
 * NOTHING HERE VALIDATES. No `required`, no client-side "please fill this in",
 * no submit gating. INVARIANTS 60-61: the SERVER names what is missing and the
 * client does not author that list, so an empty form is SENT and the refusal
 * that comes back is the one the reader sees. A client-side check would be a
 * second, drifting list nobody could audit against the pipeline.
 *
 * The design asks for "page count + jurisdiction read-only (read from clerk
 * stamp)" and only PAGE COUNT is drawn that way, because the contract splits
 * them: `Order.pages` (entities.ts:60) is nullable and SERVER-RESOLVED and is
 * `null` on a fresh package, while `jurisdiction` is a `CreateOrderRequest`
 * FIELD (endpoints.ts:42) the server takes FROM this form. Drawing jurisdiction
 * read-only would make the upload impossible — the value would never be sent
 * and the server would name it missing every time. CONTRACT CONFLICT flagged;
 * the writable field wins because the contract is upstream.
 */
export function OrderFields(props: {
  readonly values: CreateOrderRequest;
  readonly onChange: (key: keyof CreateOrderRequest, value: string) => void;
  /** Rendered after the client row — the reference seats Product there. */
  readonly productSlot?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      {MANIFEST.map((entry) => (
        <div
          key={entry.key}
          className="grid grid-cols-[150px_minmax(0,1fr)] items-start gap-6 border-b border-line-subtle py-6"
        >
          <label
            htmlFor={`order-${entry.key}`}
            className="font-mono text-label font-semibold leading-airy text-ink-secondary"
          >
            {entry.label}
          </label>
          <div className="flex flex-col gap-3">
            {entry.key === "client_id" ? (
              <ClientPicker
                value={props.values.client_id}
                onChange={(id) => props.onChange("client_id", id)}
              />
            ) : (
              /* The composite owns the value, not the box. `TextField` injects
                 a controlled `value` through `InputContext`, so an `Input`
                 carrying its own collides with it and React drops one —
                 REVIEW-03 B2, which rendered ten fields blank. */
              <TextField
                aria-label={entry.label}
                value={props.values[entry.key]}
                onChange={(next) => props.onChange(entry.key, next)}
              >
                <Input id={`order-${entry.key}`} data-testid={`order-${entry.key}`} />
              </TextField>
            )}
            <span className="font-sans text-label leading-body text-ink-muted">
              {entry.why}
            </span>
            {entry.key === "client_id" && props.productSlot}
          </div>
        </div>
      ))}

      <div className="grid grid-cols-[150px_minmax(0,1fr)] items-start gap-6 py-6">
        <span className="font-mono text-label font-semibold leading-airy text-ink-secondary">
          PAGE COUNT
        </span>
        <div className="flex flex-col gap-3">
          <span
            data-testid="order-pages-readonly"
            className="font-mono text-meta leading-close text-ink-muted"
          >
            — read from the package
          </span>
          <span className="font-sans text-label leading-body text-ink-muted">
            The server counts the pages when it can read them. Until it has,
            there is no count — a zero here would assert somebody looked.
          </span>
        </div>
      </div>
    </div>
  );
}
