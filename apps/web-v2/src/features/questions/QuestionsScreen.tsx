import { useQuery } from "@tanstack/react-query";
import { ScreenTitle } from "../../app/ScreenTitle";
import { OrderIdentityStrip } from "./OrderIdentityStrip";
import { SignoffCard } from "./SignoffCard";
import { orderSignoffQuery, SIGNOFF_ORDER_ID } from "./queries";

/**
 * STEP 2 — the abstractor claims their own work, before the pipeline runs.
 *
 * This is not QC. The reviewer downstream vouches for the report; this screen
 * is the person who did the search saying what they did, at the moment they
 * hand it over. Moving it after the pipeline would turn every answer into a
 * memory of work done days ago, and a NO into an accusation rather than a
 * disclosure.
 *
 * NOTHING IS PREFILLED HERE. The server marks which lines client policy has an
 * answer for; the row shows that and still costs a press. Whether policy may
 * prefill at all is OPEN RULING Q13, and the design's own words — policy can
 * suggest, only a person can sign — are rendered verbatim so the distinction
 * survives either ruling.
 *
 * CONTRACT GAP: no sign-off submit endpoint and no pipeline-start endpoint.
 * Answers and their required comments are local state over the fetched
 * baseline; "Start pipeline" has nothing to call and stays disabled.
 */
export function QuestionsScreen() {
  const { data, isPending, isError } = useQuery(orderSignoffQuery(SIGNOFF_ORDER_ID));

  if (isError) return <p className="text-base text-state-halt-ink">Sign-off unavailable.</p>;
  if (isPending) return <p className="text-base text-ink-secondary">Loading sign-off…</p>;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-3">
        <ScreenTitle>Step 2 — Sign-off</ScreenTitle>
        <h1 className="text-4xl font-semibold">Confirm what you did on this search</h1>
        <p className="max-w-2xl text-md leading-body text-ink-secondary">
          You answer these before the pipeline runs — this is you claiming your
          own work at the moment you hand it over, not the QC reviewer vouching
          for it later. All required. Suggested answers come from this
          client&apos;s reviewed policy; you still answer each line.
        </p>
      </header>

      <OrderIdentityStrip
        productName={data.product_name}
        periodLabel={data.period_label}
        signedBy={data.signed_by}
        signedAt={data.signed_at}
      />

      <SignoffCard signoff={data} />
    </div>
  );
}
