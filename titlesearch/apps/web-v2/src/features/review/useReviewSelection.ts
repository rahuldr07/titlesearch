import { useNavigate } from "@tanstack/react-router";
import type { Field } from "@titlepipe/contract";

/**
 * Which field is selected, and how selection moves.
 *
 * SELECTION IS URL-OWNED, so `?field=` is a first-class deep link and the back
 * button walks a reviewer's own path through the order rather than dumping them
 * on the screen they entered from.
 *
 * J AND K WALK ONLY QUEUED FIELDS (`review.spec` #9), while a CLICK may land
 * anywhere. The queue is the server's judgment about what needs a person;
 * keyboard walking past it is how a reviewer starts re-deciding settled fields,
 * and clicking is a deliberate act that does not accumulate.
 */
export function useReviewSelection(orderId: string, fields: readonly Field[], fieldParam?: string) {
  const navigate = useNavigate();
  const queued = fields.filter((field) => field.state === "needs_review");
  const selected =
    fields.find((field) => field.path === fieldParam) ?? queued[0] ?? fields[0] ?? null;

  const select = (path: string) => {
    void navigate({ to: "/orders/$orderId/review", params: { orderId }, search: { field: path } });
  };

  const step = (delta: number) => {
    if (selected === null || queued.length === 0) return;
    const at = Math.max(queued.findIndex((field) => field.path === selected.path), 0);
    const size = queued.length;
    const next = queued[(((at + delta) % size) + size) % size];
    if (next) select(next.path);
  };

  /** After a decision lands, move to the next field still awaiting one. */
  const advance = () => {
    const next = queued.find((field) => field.path !== selected?.path);
    if (next) select(next.path);
  };

  return { queued, selected, select, step, advance };
}
