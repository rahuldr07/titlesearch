import type { OrderSignoffResponse } from "@titlepipe/contract";
import { Card, CardFooter, CardHeader } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { DividedSection } from "../../shared/ui/ListRow";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { OrderContextRow } from "../order/OrderContextRow";
import { SignoffLineRow } from "./SignoffLineRow";

/**
 * The sign-off as the record it already is — read by everyone downstream of the
 * person who made it.
 *
 * RULE: once a person has signed, the screen stops offering to change it.
 * FAILURE PREVENTED: `SignoffCard` drew live answer buttons and comment boxes
 * over a signed record, so a reviewer could answer thirteen questions that had
 * nowhere to go. CONTRACT GAP: there is no sign-off amendment endpoint, and an
 * append-only signature is not editable in place even once one lands — an
 * amendment is a NEW signature, not a rewrite of this one. This block therefore
 * renders no control at all, rather than disabled ones: a disabled button says
 * "not now", and the honest statement is "not here".
 *
 * THE HEADER NAMES WHO SIGNED AND WHEN, because "signed" without a signer is the
 * claim with the accountability removed, and for the downstream reviewer this
 * block is the only place either appears.
 *
 * THE FOOTER COUNTS ANSWERED LINES, NOT LINES. `lines.length` is how many lines
 * EXIST; a footer reading "13 lines answered" over a block whose own rows are
 * drawing NOT ANSWERED is the screen contradicting itself in two places at once.
 * Neither number is a rate and neither is per-person: they describe the list
 * immediately above them and nothing beyond it.
 *
 * PROVISIONAL UNTIL SIGNED. An unsigned sign-off takes the dashed border — the
 * design's mark for a thing proposed with no record behind it — so a policy
 * prefill can never be mistaken at a glance for a signature.
 */
export function SignoffReadonly({ signoff }: { signoff: OrderSignoffResponse }) {
  const signed = signoff.signed_by !== null;
  const answered = signoff.lines.filter((line) => line.answer !== null).length;
  const disclosed = signoff.lines.filter((line) => line.answer === "NO").length;
  const suggested = signoff.lines.filter((line) => line.prefilled_from_policy).length;

  return (
    <Card accent="action" dashed={!signed} data-testid="signoff-readonly">
      <CardHeader filled={signed} className="flex-col items-start gap-3">
        <div className="flex flex-wrap items-center gap-5">
          <Eyebrow variant="section" tone="action">
            Abstractor Sign-off
          </Eyebrow>
          {signed ? (
            <Chip size="sm">SIGNED AT INTAKE · READ-ONLY</Chip>
          ) : (
            <Chip tone="action" size="sm" bordered>
              NOT SIGNED · POLICY PREFILL
            </Chip>
          )}
        </div>

        {signed ? (
          <p className="text-xs leading-body text-ink-secondary">
            Answered by{" "}
            <span className="font-semibold text-ink-primary">{signoff.signed_by}</span>
            {signoff.signed_at === null ? "" : ` · ${signoff.signed_at}`}. You review
            the search — you don&rsquo;t re-sign it.
          </p>
        ) : (
          <p className="text-xs leading-body text-action-ink">
            <span className="font-semibold">Not signed.</span>{" "}
            {suggested === 0
              ? null
              : `Client policy has a suggested answer on ${suggested} of these lines, and none of it is filled in. `}
            Policy can suggest; only a person can sign.
          </p>
        )}
      </CardHeader>

      <div className="flex flex-col gap-4 border-b border-line-subtle bg-surface-sunken px-8 py-5">
        <OrderContextRow
          productName={signoff.product_name}
          periodLabel={signoff.period_label}
        />
        <p className="text-xs leading-body text-ink-muted">
          Declared by the product ordered — this is not a yes/no answer.
        </p>
      </div>

      <DividedSection>
        {signoff.lines.map((line) => (
          <SignoffLineRow key={line.line_id} line={line} />
        ))}
      </DividedSection>

      <CardFooter>
        {answered === 0
          ? "No line has been answered — nothing here is signed."
          : `${answered} of ${signoff.lines.length} answered · ${disclosed} disclosed as NO.`}
      </CardFooter>
    </Card>
  );
}
