import { Chip } from "../../shared/ui/Chip";

/**
 * An order's status, as the server states it.
 *
 * The whole value of this component is the TYPE: it takes a label and a tone
 * that the server supplied and has no way to compute either. Hard constraint 9
 * forbids a client-side state machine, and `design-classification.md` C2
 * records the export deriving its status stamp from a five-branch `if/else` in
 * the browser — exactly what this shape makes impossible.
 *
 * `OrderStatus` is deliberately `z.string()` in the contract — *"OPEN until the
 * Flask models are ported (P1) — they are the source of truth. Do not invent
 * closed enums here."* So `label` is a string, not a union. Inventing the enum
 * here would be inventing the state machine one level down.
 */
export function OrderStatusChip({
  label,
  tone,
}: {
  /** Server-supplied display text. Never derived, never mapped from a code. */
  label: string;
  /** Server-supplied severity. The client does not decide what is urgent. */
  tone: "neutral" | "action" | "settled" | "attend" | "halt";
}) {
  return (
    <Chip tone={tone} size="sm" bordered={tone === "action" || tone === "halt"}>
      {label}
    </Chip>
  );
}
