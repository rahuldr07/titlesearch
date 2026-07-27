import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { BlindEntriesResponse } from "@titlepipe/contract";
import { post } from "../../shared/api";
import { BLIND_SECTIONS, type BlindEntry } from "./roster";
import { FieldCapture } from "./FieldCapture";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Button } from "../../shared/ui/Button";

/**
 * The capture seat. STRUCTURALLY BLIND — and structurally, not by policy.
 *
 * `blind.spec` #1 greps the rendered page for "gemini", "llmwhisperer",
 * "engine", "needs_review", "reader a"… and `blind-blindness.spec` #1 proves it
 * at the network level: ZERO `/api` GETs leave this screen. There is nothing to
 * leak because nothing is fetched. That is the difference between a screen that
 * hides the model's answer and one that cannot show it.
 *
 * SEAT LABEL, NEVER A NAME. "typist B" is who you are here. Blind double-entry
 * only works if neither typist can be identified to the other.
 *
 * NO CLOCK, NO RATE, NO SCORE (`blind.spec` #2). There is nothing here to be
 * fast at, and the screen says so.
 */
export function BlindSeat() {
  const { orderId } = useParams({ from: "/blind/$orderId" });
  const [entries, setEntries] = useState<Record<string, BlindEntry>>({});
  const [typeConfirmed, setTypeConfirmed] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);

  const submit = useMutation({
    mutationFn: (payload: BlindEntry[]) =>
      post(`/api/blind/${orderId}/entries`, BlindEntriesResponse, { entries: payload }),
    onSuccess: () => setDone(true),
  });

  if (done) {
    return (
      <Card data-testid="blind-submitted" size="emphasis" accent="action">
        <CardBody>
          <Eyebrow variant="screen">Submitted.</Eyebrow>
          <p className="mt-4 text-base leading-body text-ink-secondary">
            Reconciliation runs when both typists finish this order. Where you
            diverge, a senior rules on the batch — you are not involved, and you
            will not see the other set of answers.
          </p>
          <div className="mt-8">
            {/* Never a dead end: the done card carries a door out. */}
            <Link to="/account" data-testid="blind-done-door">
              <Button fill="outlined" tone="neutral">Back to your account</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div data-testid="blind-seat">
        <Eyebrow variant="screen">Blind fifty</Eyebrow>
        <p className="mt-2 text-base text-ink-secondary">
          typist B · saved at the field level, automatically — leave any time,
          nothing is lost
        </p>
        <p className="mt-3 text-base font-semibold text-ink-primary">
          Structurally blind — no other set of answers, no suggestions. Not
          policy; the screen cannot show them.
        </p>
      </div>

      {BLIND_SECTIONS.map((section) => {
        const typeField = section.fields.find((f) => f.isType);
        const typeRecorded = typeField ? Boolean(entries[typeField.id]) : true;

        return (
          <Card key={section.name}>
            <CardHeader filled>
              <Eyebrow variant="section">{section.name}</Eyebrow>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              {section.note ? (
                <p className="text-base leading-body text-state-attend-ink">{section.note}</p>
              ) : null}

              {section.fields.map((field) => (
                <FieldCapture
                  key={field.id}
                  field={field}
                  settled={entries[field.id]}
                  disabled={field.gated === true && !typeRecorded}
                  disabledNote={`${field.label} — opens after TYPE is recorded above`}
                  recordBlocked={field.isType === true && !typeConfirmed[field.id]}
                  onRecord={(entry) => setEntries((e) => ({ ...e, [entry.path]: entry }))}
                />
              ))}

              {/* The judgment TYPE second pass. A lis pendens, a FiFa and a
                  judgment look alike in an index and are three different things
                  on a report, so TYPE is read twice before it gates its
                  siblings (`blind.spec` #5). */}
              {typeField && !entries[typeField.id] && !typeConfirmed[typeField.id] ? (
                <div className="rounded-7 border border-state-attend-border bg-state-attend-surface p-6">
                  <Eyebrow variant="caption" tone="attend">
                    Second pass — read the caption again
                  </Eyebrow>
                  <p className="mt-2 text-base text-ink-secondary">
                    A lis pendens, a FiFa and a judgment look alike in an index
                    and are three different things on a report.
                  </p>
                  <div className="mt-5">
                    <Button
                      size="sm"
                      tone="attend"
                      data-testid="type-gate-confirm"
                      onClick={() =>
                        setTypeConfirmed((t) => ({ ...t, [typeField.id]: true }))
                      }
                    >
                      Confirm TYPE — I re-read the caption
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>
        );
      })}

      <div className="flex flex-wrap items-center gap-6">
        <Button
          data-testid="blind-submit"
          disabled={submit.isPending}
          onClick={() => submit.mutate(Object.values(entries))}
        >
          Submit this order
        </Button>
        <span className="text-xs text-ink-muted">
          no clock, no rate, no score — there is nothing here to be fast at
        </span>
      </div>
    </div>
  );
}
