import type { ConfigLine } from "@titlepipe/contract";
import { useState } from "react";

import { Button } from "../../shared/ui/Button";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Select, SelectItem, SelectPopup, SelectTrigger } from "../../shared/ui/Select";
import { TextField } from "../../shared/ui/TextField";
import { Toggle, ToggleGroup } from "../../shared/ui/ToggleGroup";

const OVERRIDE_ACTIONS = [
  { value: "waive", label: "Waive" },
  { value: "narrow", label: "Narrow scope" },
  { value: "replace", label: "Replace standard" },
  { value: "add", label: "Add line" },
] as const;

const PLACEHOLDER: Readonly<Record<string, string>> = {
  waive: "Reason (optional)",
  narrow: "Narrowed scope text",
  replace: "Replacement standard",
  add: "New client-specific line text",
};

/**
 * Authoring a delta: pick the ACT first, then what it acts on.
 *
 * Action before line, because the action decides whether a line picker is even
 * meaningful — "add" invents a line this client alone answers, so there is
 * nothing in the baseline to point at. Asking for a line first would make the
 * one case that has no line the awkward exception.
 *
 * The picker offers catalogue lines only. An override against a line the
 * product never asks for is not a difference, it is a note nobody will ever
 * read at intake, and letting it be authored would put entries in the delta
 * list that resolve to nothing.
 */
export function AuthorOverride({
  productName,
  lines,
}: {
  productName: string;
  lines: readonly ConfigLine[];
}) {
  const [action, setAction] = useState<readonly string[]>(["waive"]);
  const [line, setLine] = useState<string | null>(null);
  const current = action[0] ?? "waive";

  return (
    <div className="mt-6 border-t border-line-subtle pt-6">
      <Eyebrow variant="field" as="h3">
        Author an override · against {productName}
      </Eyebrow>

      <ToggleGroup
        className="mt-4"
        aria-label="Override action"
        value={action}
        onValueChange={(next) => {
          if (next[0] !== undefined) setAction(next);
        }}
      >
        {OVERRIDE_ACTIONS.map((a) => (
          <Toggle key={a.value} value={a.value} className="rounded-5">{a.label}</Toggle>
        ))}
      </ToggleGroup>

      {current === "add" ? null : (
        <div className="mt-4">
          <Select value={line} onValueChange={(v) => setLine(typeof v === "string" ? v : null)}>
            <SelectTrigger
              aria-label="Baseline line to override"
              placeholder="Choose a baseline line…"
              className="rounded-5"
            />
            <SelectPopup>
              {lines
                .filter((l) => !l.retired)
                .map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {`${l.id} · ${l.label}`}
                  </SelectItem>
                ))}
            </SelectPopup>
          </Select>
        </div>
      )}

      <TextField
        size="sm"
        className="mt-4"
        aria-label="Override text"
        placeholder={PLACEHOLDER[current] ?? "Reason (optional)"}
      />

      {/* CONTRACT GAP: authoring an override publishes a config version; no endpoint exists. */}
      <Button className="mt-4" disabled data-testid="add-override">
        Add override
      </Button>

      <p className="mt-4 text-tiny leading-body text-ink-muted">
        Removing an override returns that line to the baseline — “stop
        differing,” not “remove the line.”
      </p>
      <p className="mt-2 text-tiny leading-body text-ink-muted">
        CONTRACT GAP: overrides are served read-only. Nothing typed here is
        submitted.
      </p>
    </div>
  );
}
