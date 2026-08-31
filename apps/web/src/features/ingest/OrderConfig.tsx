import type { CreateOrderRequest, QuarantineResolved } from "@titlepipe/contract";
import { TextField } from "react-aria-components";
import { Input } from "../../components/ui";
import { ClientSelect } from "./ClientSelect";
import { ProductSelect } from "./ProductSelect";
import { RulebookNote } from "./RulebookNote";
import { RulebookBanner } from "./RulebookBanner";

/**
 * Order configuration. Jurisdiction, state and county are not typable
 * anywhere — the paired read-only row prints the server's clerk-stamp readout
 * or its stated absence. Nothing here validates: no `required`, no
 * client-side "please fill this in" — the server names what is missing, so an
 * empty form is sent and the refusal that comes back is the one the reader
 * sees.
 */
export function OrderConfig(props: {
  readonly values: CreateOrderRequest;
  readonly onValue: (key: keyof CreateOrderRequest, value: string) => void;
  /** The clerk-stamp readout, once the server has one. Null before. */
  readonly resolved: QuarantineResolved | null;
}) {
  return (
    <div className="flex flex-col gap-8">
      <label className="flex flex-col gap-3">
        <span className="font-sans text-label font-bold leading-flat text-ink-muted">
          Client
        </span>
        <ClientSelect
          value={props.values.client_id}
          onChange={(id) => props.onValue("client_id", id)}
        />
      </label>

      <label className="flex flex-col gap-3">
        <span className="font-sans text-label font-bold leading-flat text-ink-muted">
          Product
        </span>
        <ProductSelect
          value={props.values.product}
          onChange={(id) => props.onValue("product", id)}
        />
      </label>

      <TextField
        aria-label="Client Order #"
        value={props.values.external_ref}
        onChange={(next) => props.onValue("external_ref", next)}
        className="flex flex-col gap-3"
      >
        <span className="font-sans text-label font-bold leading-flat text-ink-muted">
          Client Order #
        </span>
        <Input data-testid="order-external_ref" className="font-mono" />
      </TextField>

      <div className="grid grid-cols-2 gap-8">
        <div className="flex flex-col gap-3">
          <span className="font-sans text-label font-bold leading-flat text-ink-muted">
            Page Count
          </span>
          <span
            data-testid="order-pages-readonly"
            className="flex h-19 items-center rounded-md border border-control-border bg-surface-sunken px-5 font-mono text-meta leading-close text-ink-muted"
          >
            {props.resolved?.page_count_label ?? "—"}
          </span>
        </div>
        <div className="flex flex-col gap-3">
          <span className="font-sans text-label font-bold leading-flat text-ink-muted">
            Jurisdiction
          </span>
          <span
            data-testid="order-jurisdiction-readonly"
            title="Read from the recorded clerk stamp — never hand-entered"
            className="flex h-19 items-center truncate rounded-md border border-control-border bg-surface-sunken px-5 font-mono text-meta leading-close text-ink-muted"
          >
            {props.resolved?.jurisdiction_label ?? "— read from clerk stamp"}
          </span>
        </div>
      </div>

      <RulebookNote resolved={props.resolved} />

      <RulebookBanner
        clientId={props.values.client_id}
        productId={props.values.product}
      />
    </div>
  );
}
