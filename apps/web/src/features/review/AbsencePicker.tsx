import type { NaReason } from "@titlepipe/contract";
import { Option, Select } from "../../components/ui";

/**
 * LAW 3 — DECLARING WHICH ABSENCE THIS IS, AND THERE ARE FOUR OF THEM.
 *
 * The design draws a "Declare Null Provenance" grid of four choices
 * (`reference-app.html` §isReview, `naOnly`). Its own model carried two; the
 * contract ratified FOUR on 2026-07-26 (`enums.ts:20-52`), and the sentences
 * below are that enum's own prose rather than the prototype's — they route
 * differently and must never collapse.
 *
 * NOT GATED ON `value === null`. The prototype shows this grid INSTEAD of
 * confirm/edit for a field its fixture flags `NA_ONLY`. Nothing on the wire
 * carries that flag, and `enums.ts:44-48` forbids the obvious substitute:
 * "never key anything off `value === null`". So the declaration is a fourth act
 * available on every open decision, and the reviewer decides — which is what
 * the act is for.
 */
const ABSENCE_OPTIONS: readonly {
  readonly reason: NaReason;
  readonly label: string;
  readonly sentence: string;
}[] = [
  {
    reason: "NOT_PRESENT",
    label: "Structurally absent in this jurisdiction",
    sentence:
      "The field does not exist for instruments of this kind here. Correct, and never surfaced for review again.",
  },
  {
    reason: "NOT_FOUND",
    label: "Searched — nothing of record",
    sentence:
      "The field exists in this jurisdiction and was searched for. A real gap in the record is a finding, not a blank.",
  },
  {
    reason: "NOT_STATED",
    label: "Instrument silent",
    sentence:
      "The search returned the document and the document does not say. Distinct from nothing of record.",
  },
  {
    reason: "PRESENT_UNREADABLE",
    label: "Present — could not be read",
    sentence:
      "It is on the page and the scan could not resolve it. The only absence that carries a page reference.",
  },
];

function isNaReason(key: unknown): key is NaReason {
  return ABSENCE_OPTIONS.some((option) => option.reason === key);
}

export function AbsencePicker(props: {
  readonly reason: NaReason | null;
  readonly onPick: (reason: NaReason) => void;
}) {
  const picked = ABSENCE_OPTIONS.find((option) => option.reason === props.reason);

  return (
    <div className="flex flex-col gap-3">
      <Select
        data-testid="na-state-select"
        label="Which absence is this?"
        placeholder="Choose the absence this field is"
        {...(props.reason === null ? {} : { selectedKey: props.reason })}
        onSelectionChange={(key) => {
          if (isNaReason(key)) props.onPick(key);
        }}
      >
        {ABSENCE_OPTIONS.map((option) => (
          <Option key={option.reason} id={option.reason}>
            {option.label}
          </Option>
        ))}
      </Select>

      {/* The taxonomy's own sentence, at the point of choice. The four route
          differently downstream, so the reviewer is told how before filing. */}
      <p
        data-testid="na-state-sentence"
        className="text-meta leading-body text-ink-secondary"
      >
        {picked === undefined
          ? "Four absences, and they are not interchangeable. Choose the one the document supports."
          : picked.sentence}
      </p>
    </div>
  );
}
