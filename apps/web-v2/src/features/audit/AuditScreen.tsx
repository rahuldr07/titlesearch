import { useQuery } from "@tanstack/react-query";
import { auditQuery } from "./queries";
import { AuditRow } from "./AuditRow";
import { AuditFilters } from "./AuditFilters";
import { Card } from "../../shared/ui/Card";
import { EmptyPanel } from "../../shared/ui/EmptyPanel";
import { DividedSection } from "../../shared/ui/ListRow";
import { Screen } from "../../shared/ui/Screen";
import { ScreenHeading } from "../../shared/ui/ScreenHeading";
import { ScreenMessage } from "../../shared/ui/ScreenMessage";

/**
 * THE RECORD. Append-only: who did what, to which order, when, and on what
 * evidence.
 *
 * This screen exists so that "who amended that claim" has an answer. Every
 * consequential act in the product — a corrected value, a confirmed rule, a
 * suspended account — is somebody's signature, and a signature nobody can look
 * up later is not a signature. The value of the record is entirely in its being
 * complete, which is why there is no edit, no delete, and no filter that can
 * quietly drop a row.
 *
 * NO SEARCH BOX, NO PAGINATION, NO SORT. The endpoint returns the record as the
 * server ordered it — newest first — and the client reorders nothing. A sort
 * control on an append-only log invites reading it as a table of facts rather
 * than a sequence of acts, and the sequence is the evidence: what somebody knew
 * when they acted is the row above theirs.
 *
 * ONE ROW PER ENTRY, NEVER GROUPED. Collapsing three corrections by the same
 * person into "R. Delacroix · 3 changes" is exactly the summary that hides the
 * one that mattered.
 */
export function AuditScreen() {
  const { data, isPending, isError } = useQuery(auditQuery);

  /*
   * A RECORD THAT DID NOT LOAD IS NOT AN EMPTY RECORD, and on this screen that
   * distinction is the whole product: "nothing recorded" is a claim about what
   * people did, and a failed request that draws like one asserts innocence the
   * server never reported. `ScreenMessage` says *not loaded*; the panel below
   * says *resolved and empty*. They are never interchangeable here.
   */
  if (isError) {
    return (
      <ScreenMessage tone="halt" measure="940">
        The record is unavailable.
      </ScreenMessage>
    );
  }
  if (isPending) {
    return <ScreenMessage measure="940">Loading the record…</ScreenMessage>;
  }

  return (
    <Screen measure="940">
      <div className="flex flex-col gap-6">
        <ScreenHeading
          eyebrow="Admin · Audit"
          /*
            NO `<em>` HERE, DELIBERATELY. RULE: the signature italic takes a
            closing phrase. "The record" is an article and a noun — emphasising
            the noun is emphasising the whole heading with extra steps. FAILURE
            PREVENTED: this screen's authority comes from being flat and
            complete; a masthead that performs is the wrong voice for a log
            whose entire claim is that nothing here was styled or chosen.
          */
          title="The record"
          lede={
            <p>
              Append-only: who did what, to which order, when, and on what evidence.
              Read-only — no edit, no delete. This is how &ldquo;who amended that
              claim&rdquo; has an answer.
            </p>
          }
        />

        <AuditFilters />

        {data.entries.length === 0 ? (
          <EmptyPanel
            title="Nothing recorded yet."
            body="An empty record is a young system, not a clean one."
          />
        ) : (
          <Card>
            <DividedSection data-testid="audit-list">
              {data.entries.map((entry) => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </DividedSection>
          </Card>
        )}
      </div>
    </Screen>
  );
}
