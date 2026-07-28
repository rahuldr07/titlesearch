import { useState } from "react";
import { Button } from "../../shared/ui/Button";
import { TextField } from "../../shared/ui/TextField";
import { Toggle, ToggleGroup } from "../../shared/ui/ToggleGroup";
import { PRODUCT_CHANGE_OPTIONS } from "./gapFixtures";

/**
 * Changing the product is the only way out of this gap that touches money.
 *
 * The client paid for a span; shortening it to make a gap disappear is a
 * commercial act wearing the costume of a data fix. The panel therefore says so
 * in its heading, requires a reason, and states that the order's history will
 * carry the change — from what, by whom, and why. The reason is required for
 * the same purpose as the root-of-title comment: without it, a legitimate
 * re-scope and a quiet downgrade look identical in the record.
 *
 * CONTRACT GAP: no product-change endpoint, and no order-history write. In the
 * product this is a priced change with an audit entry, not a form.
 */
export function ProductChangeForm({
  onConfirm,
  onCancel,
}: {
  onConfirm: (target: string, reason: string) => void;
  onCancel: () => void;
}) {
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const ready = target !== "" && reason.trim() !== "";

  return (
    <div className="mt-6 rounded-7 border border-state-attend-border bg-state-attend-surface px-7 py-6">
      <p className="text-xs font-bold text-state-attend-ink">Change product — money attached</p>
      <p className="mt-1 mb-4 text-xs text-ink-secondary">
        The order&apos;s history will show the change, from what, by whom, and why.
      </p>

      <ToggleGroup
        aria-label="Change the product ordered to"
        className="mb-4 gap-2"
        value={target === "" ? [] : [target]}
        onValueChange={(value) => setTarget(value[0] ?? "")}
      >
        {PRODUCT_CHANGE_OPTIONS.map((option) => (
          <Toggle key={option} value={option} className="px-5 py-3 text-xs">
            {option}
          </Toggle>
        ))}
      </ToggleGroup>

      <TextField
        size="sm"
        tone="attend"
        value={reason}
        aria-label="Reason for the product change"
        placeholder="Reason for the product change (required)"
        onChange={(event) => setReason(event.target.value)}
      />

      <div className="mt-5 flex gap-4">
        <Button
          size="sm"
          tone="attend"
          disabled={!ready}
          onClick={() => onConfirm(target, reason.trim())}
        >
          Change product &amp; record
        </Button>
        <Button size="sm" tone="neutral" fill="outlined" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
