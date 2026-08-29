import type { Order } from "@titlepipe/contract";
import { useRead } from "../../app/useRead";
import { QueryState } from "../../entities/state/QueryState";
import { quarantine } from "./quarantineQueries";
import { QuarantineGateway } from "./QuarantineGateway";
import { OpticalProfile } from "./OpticalProfile";
import { RulebookBanner } from "./RulebookBanner";

/**
 * THE GATEWAY, READ WHERE AN ORDER EXISTS. The design (README §22) draws the
 * checklist under the upload form's file row; here it renders on the ACCEPT
 * stage instead, because `GET /api/orders/{id}/quarantine` is order-scoped and
 * no order exists until the upload returns one — the same two-act split
 * INVARIANT 47 imposes on the design's single Sign button.
 *
 * ONE read feeds all three children, so the checklist, the optical card and
 * the banner's amber→green flip can never disagree about what the server said.
 *
 * WHAT IS DELIBERATELY NOT HERE: a gate on the Accept button. The design says
 * "Sign button disabled-with-reason until ready", but `QuarantineResponse`
 * (design2.ts:35-42) carries no readiness member — only per-step states — and
 * the accept endpoint refuses nothing on quarantine grounds. A client that
 * disabled the signature on its own reading of the steps would be authoring a
 * gate the server does not enforce. CONTRACT GAP: no `may_accept` (with its
 * reason) on QuarantineResponse; until one exists, the server's accept
 * refusal is the gate, as it is everywhere else.
 */
export function QuarantinePanel(props: { readonly order: Order }) {
  const read = useRead(quarantine(props.order.id));

  return (
    <QueryState query={read} of="the quarantine gateway">
      {(data) => (
        <div
          data-testid="quarantine-panel"
          className="grid grid-cols-2 items-start gap-12 rounded-lg border border-line-strong bg-surface-panel p-12 shadow-card"
        >
          <QuarantineGateway data={data} />
          <div className="flex flex-col gap-8">
            <OpticalProfile optical={data.optical} />
            <RulebookBanner clientId={props.order.client_id} quarantine={data} />
          </div>
        </div>
      )}
    </QueryState>
  );
}
