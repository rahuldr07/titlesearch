import { useQuery } from "@tanstack/react-query";
import { SignoffReadonly } from "../../entities/signoff/SignoffReadonly";
import { Screen } from "../../shared/ui/Screen";
import { ScreenHeading } from "../../shared/ui/ScreenHeading";
import { ScreenMessage } from "../../shared/ui/ScreenMessage";
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
 * ONE COLUMN, NARROWER THAN THE PAGE. The design holds the thirteen lines to a
 * measure a person can read down without their eye losing the row it is on —
 * the question on the left, its three answers always at the same right-hand
 * stop. Letting the card run to the full page width puts a hand's span of empty
 * paper between a question and the button that answers it.
 *
 * CONTRACT GAP: no sign-off submit endpoint and no pipeline-start endpoint.
 * Answers and their required comments are local state over the fetched
 * baseline; "Start pipeline" has nothing to call and stays disabled.
 */
export function QuestionsScreen() {
  const { data, isPending, isError } = useQuery(orderSignoffQuery(SIGNOFF_ORDER_ID));

  if (isError)
    return (
      <ScreenMessage tone="halt" measure="640">
        Sign-off unavailable.
      </ScreenMessage>
    );
  if (isPending) return <ScreenMessage measure="640">Loading sign-off…</ScreenMessage>;

  return (
    <Screen measure="640" pad="36x40">
      <div className="flex flex-col gap-7">
        {/*
          RULE: the mockup's signature is the CLOSING phrase of a heading set in
          Fraunces italic, and `ScreenHeading` paints any descendant `<em>` — the
          call site writes only the semantic element. FAILURE PREVENTED: the
          accent going on "you did", the phrase a designer reaches for first,
          which is the sentence's subject rather than its close and would leave
          the heading emphasising a pronoun. The scope is what this screen is
          about: these are the answers for THIS search, made now, not the QC pass
          that comes later — which is exactly what the lede below spends three
          clauses saying.
        */}
        <ScreenHeading
          eyebrow="Step 2 — Sign-off"
          title={
            <>
              Confirm what you did <em>on this search</em>
            </>
          }
          lede="You answer these before the pipeline runs — this is you claiming your own work at the moment you hand it over, not the QC reviewer vouching for it later. All required. Suggested answers come from this client's reviewed policy; you still answer each line."
        />

        <OrderIdentityStrip
          productName={data.product_name}
          periodLabel={data.period_label}
        />

        {/* SIGNED IS A DIFFERENT SCREEN, NOT A DISABLED ONE. `signed_by` is the
            server's, and once it is set the answers are a record: there is no
            amendment endpoint, and an append-only signature is not edited in
            place. Drawing live answer buttons over it offered an act nothing
            accepts, on a record the person reading it did not make.

            THE READ-ONLY BRANCH IS A GUARD HERE, NOT THIS SCREEN'S SUBJECT, and
            that is why it does not render in the demo. `/questions` is where a
            sign-off is ANSWERED, so it is pointed at an order at intake and the
            server correctly serves that order unsigned — `signoffFor` derives
            `signed_by` from the order's stage, so the branch can only fire on an
            order that moved past intake while this screen was open. Making it
            appear here by default would mean pointing the answering screen at an
            order with nothing left to answer.

            WHERE IT ACTUALLY LIVES IS REVIEW (`features/review/ReportPane.tsx`,
            2026-08-03), which is where the design puts it and where a reviewer
            reads a signature somebody else made. That closed the last open item
            from the 2026-08-01 handoff: this block used to be reachable only as
            a story, so the branch below was the one place it appeared in code
            and nowhere in the running app. It stays here as the guard it is —
            if an order IS signed while this screen is open, the answering form
            must not draw over the record. */}
        {data.signed_by === null ? (
          <SignoffCard signoff={data} />
        ) : (
          <SignoffReadonly signoff={data} />
        )}
      </div>
    </Screen>
  );
}
