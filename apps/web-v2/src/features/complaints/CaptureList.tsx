import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { shippedFieldsQuery, useCaptureComplaint } from "./queries";
import { NoValue } from "../../entities/field/NoValue";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextField } from "../../shared/ui/TextField";
import { Button } from "../../shared/ui/Button";

/**
 * Capture is PER FIELD, never per report. "The report was wrong" is not
 * actionable; "assessment.city_tax said nothing and the client has a
 * delinquent line" is a ticket, a rule, and a golden case.
 *
 * A PENDING field renders "not yet extracted", never "Not Available"
 * (`hard.spec` #6). The same rule as the review screen, and it matters more
 * here: a client is telling you a value was wrong, and confusing "we did not
 * look" with "the document does not say" sends the investigation the wrong way.
 */
export function CaptureList({ orderId }: { orderId: string }) {
  const { data, isPending } = useQuery(shippedFieldsQuery(orderId));
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [should, setShould] = useState("");
  const [words, setWords] = useState("");
  const capture = useCaptureComplaint();

  if (isPending) return <p className="text-base text-ink-secondary">Loading the shipped report…</p>;

  return (
    <Card>
      <CardHeader filled>
        <Eyebrow variant="section">Capture a complaint against a field</Eyebrow>
      </CardHeader>
      <CardBody className="p-0">
        <ul>
          {(data?.fields ?? []).map((field) => (
            <li key={field.id} className="border-t border-line-subtle first:border-t-0">
              <button
                type="button"
                data-testid={`cap-${field.path}`}
                onClick={() => setOpenPath(field.path)}
                className="flex w-full flex-wrap items-baseline gap-5 px-8 py-5 text-left"
              >
                <span className="w-1/3 font-mono text-base text-ink-primary">{field.path}</span>
                <span className="flex-1">
                  {field.value === null ? (
                    <NoValue value={{ kind: field.state === "pending" ? "pending" : "not_found" }} />
                  ) : (
                    <span className="font-mono text-base text-ink-primary">{field.value}</span>
                  )}
                </span>
              </button>

              {openPath === field.path ? (
                <div className="flex flex-col gap-4 border-t border-line-subtle bg-surface-sunken px-8 py-6">
                  <label className="flex flex-col gap-2">
                    <Eyebrow variant="field">What should it have said?</Eyebrow>
                    <TextField
                      data-testid="cap-should"
                      value={should}
                      onChange={(e) => setShould(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <Eyebrow variant="field">In the client&rsquo;s words</Eyebrow>
                    <TextField
                      data-testid="cap-words"
                      value={words}
                      onChange={(e) => setWords(e.target.value)}
                    />
                  </label>
                  <div>
                    <Button
                      size="sm"
                      data-testid="cap-record"
                      disabled={should.trim() === "" || words.trim() === "" || capture.isPending}
                      onClick={() =>
                        capture.mutate(
                          {
                            order_id: orderId,
                            field_path: field.path,
                            client_value: should.trim(),
                            description: words.trim(),
                          },
                          {
                            onSuccess: () => {
                              setOpenPath(null);
                              setShould("");
                              setWords("");
                            },
                          },
                        )
                      }
                    >
                      Record this complaint
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
