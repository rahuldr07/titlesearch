import { Button, Card, CardBody, CardHeader } from "../../components/ui";
import { EntryRow } from "./EntryRow";
import { blankEntry, holdReason, type DraftEntry } from "./draftEntry";

/**
 * THE FORM, AND THE ONE PRIMARY ACTION ON THIS SCREEN.
 *
 * Rule 1 spends the accent once: it is spent on "File these entries" and
 * nowhere else, which is why adding a row is a secondary and removing one is a
 * ghost. The seat has exactly one decision — file what has been keyed — and
 * the chrome should not offer it a second one.
 *
 * ══ WHY THE HOLD IS A SENTENCE AND NOT A DEAD BUTTON ═══════════════════════
 *
 * Rule 9: every disabled control states its reason. `disabledBecause` is the
 * kit's only way to turn a control off (`disabled.ts`), so the reason is not
 * something this file could forget to supply. The sentences come from
 * `holdReason`, and every clause in it is a SCHEMA clause — see that file for
 * why a client-side check is legitimate here and is not one anywhere else on
 * this form.
 *
 * ══ SENDING BEATS THE HOLD, DELIBERATELY ═══════════════════════════════════
 *
 * INVARIANT 20: one act files one record. While the request is in flight the
 * reason shown is "sending", not "held" — a reader who clicks three times must
 * be told the server has not answered, not re-shown a validation sentence that
 * was already satisfied.
 */
export function CaptureForm(props: {
  readonly drafts: readonly DraftEntry[];
  readonly onDrafts: (next: readonly DraftEntry[]) => void;
  readonly pending: boolean;
  readonly onFile: () => void;
}) {
  const held = holdReason(props.drafts);

  return (
    <Card padding="none">
      <CardHeader>Fields keyed at this seat</CardHeader>

      <ul>
        {props.drafts.map((draft, index) => (
          <EntryRow
            key={draft.key}
            draft={draft}
            index={index}
            onChange={(next) => {
              props.onDrafts(props.drafts.map((row) => (row.key === draft.key ? next : row)));
            }}
            /*
             * `null` rather than a disabled control when there is one row left:
             * the last entry is not an act the typist is being DENIED, it is
             * the floor of `entries.min(1)` (endpoints.ts:301). Rule 12's
             * "blocked renders disabled with the rule" is about permissions,
             * and a remove button on a one-row form is not a permission.
             */
            onRemove={
              props.drafts.length > 1
                ? () => {
                    props.onDrafts(props.drafts.filter((row) => row.key !== draft.key));
                  }
                : null
            }
          />
        ))}
      </ul>

      <CardBody className="flex items-center justify-between gap-8 border-t border-line-subtle">
        <Button
          variant="secondary"
          data-testid="entry-add"
          onPress={() => {
            props.onDrafts([...props.drafts, blankEntry()]);
          }}
        >
          Add another field
        </Button>

        <Button
          variant="primary"
          data-testid="capture-file"
          disabledBecause={
            props.pending ? "Sending — the server has not answered yet." : held ?? undefined
          }
          onPress={props.onFile}
        >
          {held === null ? "File these entries" : "File these entries — held"}
        </Button>
      </CardBody>
    </Card>
  );
}
