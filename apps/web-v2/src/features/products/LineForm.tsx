import { useState } from "react";

import { Button } from "../../shared/ui/Button";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Switch } from "../../shared/ui/Switch";
import { TextArea, TextField } from "../../shared/ui/TextField";
import { ToggleGroup, Toggle } from "../../shared/ui/ToggleGroup";

import { ANSWER_CHOICES, COMMENT_CHOICES, LINE_GROUPS } from "./catalogue";

/**
 * Authoring a line.
 *
 * The banner at the top is the load-bearing part of this form: editing the
 * WORDING mints a version, it does not correct history. Two orders can be
 * answered against two wordings and each records which one it used, so an edit
 * here is never a way to make a past assertion say something else. Without that
 * stated before the textarea, "save" reads as "fix the text everywhere",
 * including on work already signed.
 *
 * Machine check is left BLANK-ABLE on purpose. A line with no check is
 * human-answered only, and the form says so rather than offering a default
 * check that would make an unverified line look verified.
 */
export function LineForm({ editing, onCancel }: { editing: boolean; onCancel: () => void }) {
  const [group, setGroup] = useState<readonly string[]>([]);
  const [answers, setAnswers] = useState<readonly string[]>(["YN"]);
  const [comment, setComment] = useState<readonly string[]>(["req"]);

  return (
    <div className="flex flex-col gap-6">
      {editing ? (
        <p className="rounded-7 border border-state-attend-border bg-state-attend-surface px-6 py-5 text-xs leading-body text-state-attend-ink">
          Editing the text creates a <span className="font-bold">new version</span>{" "}
          — it does not correct history. Two orders can be answered against two
          wordings; each order records which version it used.
        </p>
      ) : null}

      <div>
        <Eyebrow variant="field" as="label" htmlFor="line-label">
          Text the abstractor reads
        </Eyebrow>
        <TextArea id="line-label" rows={2} className="mt-3" />
      </div>

      <div>
        <Eyebrow variant="field" as="h3">Group</Eyebrow>
        <ToggleGroup
          className="mt-3"
          aria-label="Group"
          value={group}
          onValueChange={setGroup}
        >
          {LINE_GROUPS.map((g) => <Toggle key={g} value={g}>{g}</Toggle>)}
        </ToggleGroup>
      </div>

      <div>
        <Eyebrow variant="field" as="h3">Answers</Eyebrow>
        <ToggleGroup
          className="mt-3"
          aria-label="Answers"
          value={answers}
          onValueChange={setAnswers}
        >
          {ANSWER_CHOICES.map((a) => (
            <Toggle key={a.value} value={a.value} className="rounded-5">{a.label}</Toggle>
          ))}
        </ToggleGroup>
      </div>

      <div>
        <Eyebrow variant="field" as="h3">Comment on NO</Eyebrow>
        <ToggleGroup
          className="mt-3"
          aria-label="Comment on NO"
          value={comment}
          onValueChange={setComment}
        >
          {COMMENT_CHOICES.map((c) => (
            <Toggle key={c.value} value={c.value} className="rounded-5">{c.label}</Toggle>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex items-center gap-5">
        <Switch aria-labelledby="line-period-label" />
        <span id="line-period-label" className="text-sm text-ink-primary">
          Carries the order&rsquo;s computed period
        </span>
      </div>

      <div>
        <Eyebrow variant="field" as="label" htmlFor="line-machine">
          Machine check{" "}
          <span className="font-medium normal-case tracking-normal text-ink-muted">
            — leave blank for human-answered
          </span>
        </Eyebrow>
        <TextField
          id="line-machine"
          className="mt-3"
          placeholder="e.g. Treasurer parcel record segmented"
        />
      </div>

      <div>
        <Eyebrow variant="field" as="label" htmlFor="line-standard">
          Standard text{" "}
          <span className="font-medium normal-case tracking-normal text-ink-muted">
            — optional fixed reference
          </span>
        </Eyebrow>
        <TextArea id="line-standard" rows={2} className="mt-3" />
      </div>

      {/* CONTRACT GAP: no endpoint accepts a line, so saving would mint a version nothing records. */}
      <div className="flex gap-4">
        <Button size="lg" block disabled data-testid="save-line">
          {editing ? "Save as new version" : "Add line"}
        </Button>
        <Button size="lg" fill="outlined" tone="neutral" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <p className="text-xs leading-body text-ink-muted">
        CONTRACT GAP: there is no sign-off-line endpoint. Save is disabled rather
        than silently discarding what you typed.
      </p>
    </div>
  );
}
