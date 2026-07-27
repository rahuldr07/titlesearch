import { useState, type ReactNode } from "react";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextArea } from "../../shared/ui/TextField";
import { Button } from "../../shared/ui/Button";
import type { ButtonProps } from "../../shared/ui/Button";

interface AffirmActionProps {
  heading: string;
  blurb: ReactNode;
  reasonLabel: string;
  reasonTestId: string;
  buttonTestId: string;
  buttonLabel: string;
  tone: ButtonProps["tone"];
  pending: boolean;
  onSubmit: (reason: string) => void;
}

/**
 * ACTIONS 1 AND 3 — CONFIRM AS-IS, and DEMOTE TO SUSPECT.
 *
 * Both leave the VALUE alone and both still demand a reason (`golden.spec`
 * #4/#5). That is the point they share: an action that changes no value is the
 * easiest one to take without thinking, and the reason is the only thing
 * standing between "I read the document" and "I clicked the safe button".
 *
 * One component, because the difference between them is a sentence and a tag —
 * not a flow. Two near-identical files would drift, and the drift would land in
 * the one place the product cannot afford it.
 */
export function AffirmAction({
  heading,
  blurb,
  reasonLabel,
  reasonTestId,
  buttonTestId,
  buttonLabel,
  tone,
  pending,
  onSubmit,
}: AffirmActionProps) {
  const [reason, setReason] = useState("");
  const ready = reason.trim() !== "";

  return (
    <section className="flex flex-col gap-4">
      <Eyebrow variant="section">{heading}</Eyebrow>
      <p className="text-base leading-body text-ink-secondary">{blurb}</p>

      <label className="flex flex-col gap-2">
        <Eyebrow variant="field">{reasonLabel}</Eyebrow>
        <TextArea
          data-testid={reasonTestId}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>

      <div>
        <Button
          tone={tone}
          fill="outlined"
          data-testid={buttonTestId}
          disabled={!ready || pending}
          onClick={() => onSubmit(reason.trim())}
        >
          {buttonLabel}
        </Button>
      </div>
    </section>
  );
}
