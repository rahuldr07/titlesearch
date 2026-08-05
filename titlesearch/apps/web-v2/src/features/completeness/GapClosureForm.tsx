import { useId, useState } from "react";
import type { GapCloseKind, GapCloseOption } from "@titlepipe/contract";
import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { TextArea } from "../../shared/ui/TextField";
import { cn } from "../../shared/ui/classNames";

/**
 * Closing a gap is an ASSERTION, not a dismissal.
 *
 * FOUR CLOSURES, NOT ONE, BECAUSE THEY ARE FOUR DIFFERENT ACTS — a document
 * arriving is evidence, an amended answer rewrites a signed assertion, a root
 * of title is a fresh claim, a product change moves money. One green box headed
 * "{option} — required reason" made all four the same event, and the money one
 * wore the reassuring tone. The design gives the two consequential ones their
 * own panel outright: green for root of title, AMBER for the product change,
 * with its own warning line and its own verb on the button (:592-621).
 *
 * WHETHER A COMMENT IS DEMANDED IS THE SERVER'S CALL (`requires_comment`), not
 * a blanket rule this screen applies because it could not tell the options
 * apart. Where none is required the note records as null and the closed card
 * simply omits the quote — an empty pair of quotation marks would put words in
 * somebody's mouth.
 *
 * CONTRACT GAP: nothing accepts this. There is no closure write in
 * `packages/contract` — no upload, no amendment, no root-of-title assertion, no
 * product change; in the product each is an append-only record carrying the
 * option, the comment, the person and the moment. The button records into this
 * screen's own state and no further.
 *
 * CONTRACT GAP: the design's product-change panel offers the client's other
 * products as chips. No product list reaches this screen, so the panel asks for
 * the reason and stops rather than inventing five product names.
 */
/** The three the design draws. `none` is not among them: a closure is never neutral. */
type FormTone = "action" | "attend" | "settled";

interface FormCopy {
  tone: FormTone;
  heading: string | null;
  warning: string | null;
  placeholder: string;
  record: string;
}

const GENERIC_PLACEHOLDER =
  "Why does this close the gap? The order's history carries this sentence.";

const COPY: Record<GapCloseKind, FormCopy> = {
  upload: {
    tone: "settled",
    heading: null,
    warning: null,
    placeholder: GENERIC_PLACEHOLDER,
    record: "Record closure",
  },
  amend: {
    tone: "action",
    heading: null,
    warning: null,
    placeholder: GENERIC_PLACEHOLDER,
    record: "Record closure",
  },
  root_of_title: {
    tone: "settled",
    heading: "Root of title — required comment",
    warning: null,
    placeholder:
      "Why is this the root? e.g. Prior instrument is the patent from the United States, 03/1908 — nothing older of record.",
    record: "Record root of title",
  },
  change_product: {
    tone: "attend",
    heading: "Change product — money attached",
    warning: "The order's history will show the change, from what, by whom, and why.",
    placeholder: "Reason for the product change (required)",
    record: "Change product & record",
  },
};

const LABEL_INK: Record<FormTone, string> = {
  action: "text-action-ink",
  attend: "text-state-attend-ink",
  settled: "text-state-settled-ink",
};

export function GapClosureForm({
  option,
  onRecord,
  onCancel,
}: {
  option: GapCloseOption;
  onRecord: (note: string | null) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState("");
  const fieldId = useId();
  const copy = COPY[option.kind];
  const trimmed = note.trim();
  const ready = !option.requires_comment || trimmed !== "";

  return (
    <Card size="nested" tone={copy.tone} className="mt-6 px-7 py-6">
      <label
        htmlFor={fieldId}
        className={cn("mb-3 block text-xs font-semibold", LABEL_INK[copy.tone])}
      >
        {copy.heading ??
          `${option.label} — ${option.requires_comment ? "required reason" : "reason (optional)"}`}
      </label>

      {copy.warning === null ? null : (
        <p className="mb-3 text-xs leading-body text-ink-secondary">{copy.warning}</p>
      )}

      <TextArea
        id={fieldId}
        rows={2}
        size="sm"
        tone={copy.tone}
        emphasis={option.requires_comment}
        value={note}
        placeholder={copy.placeholder}
        onChange={(event) => setNote(event.target.value)}
      />

      <div className="mt-5 flex gap-4">
        <Button
          size="sm"
          tone={copy.tone}
          disabled={!ready}
          onClick={() => onRecord(trimmed === "" ? null : trimmed)}
        >
          {copy.record}
        </Button>
        <Button size="sm" tone="neutral" fill="outlined" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
