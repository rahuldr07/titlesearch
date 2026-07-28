import type { DeliveryWithReport } from "@titlepipe/contract";
import { formatRecordingDate } from "../../shared/date";

/** What this screen needs from a delivery, with every optional already resolved. */
export interface DeliveredRecord {
  orderId: string;
  /** Server-owned. The screen renders it; it never counts versions to derive it. */
  version: number;
  /** Already formatted — `null` when the server sent no usable timestamp. */
  deliveredLabel: string | null;
}

/**
 * Pick the delivery this screen is confirming.
 *
 * `GET /api/deliveries` is a LIST across every order, so a per-order screen has
 * to select. Selecting the highest `version` is not the client deciding which
 * report is current — the server assigned those numbers and a higher one exists
 * only because the server issued it. What the client must never do is infer
 * that a v2 EXISTS from anything other than the server saying so, which is why
 * this reads `report.version` and nothing else.
 *
 * `failed_transit` rows are excluded rather than shown as a lesser state: a
 * delivery that never landed has nothing to confirm, and this screen's entire
 * claim is that something arrived.
 */
export function pickDelivered(
  deliveries: readonly DeliveryWithReport[],
  orderId?: string | undefined,
): DeliveredRecord | null {
  let best: DeliveredRecord | null = null;

  for (const d of deliveries) {
    if (d.status !== "delivered") continue;
    const report = d.report;
    if (!report) continue;
    if (orderId !== undefined && report.order_id !== orderId) continue;
    if (best !== null && report.version <= best.version) continue;

    best = {
      orderId: report.order_id,
      version: report.version,
      deliveredLabel: describeDelivery(d.delivered_at),
    };
  }

  return best;
}

/**
 * `2026-07-16T14:31:47Z` → `Delivered 07/16/2026 · 14:31 UTC`.
 *
 * STRING SLICING, NO `Date`. §8's rule exists because parsing an instant and
 * re-rendering it shifts the date across a timezone boundary — on a delivered
 * report that is a legally significant number rendered a day early.
 *
 * The zone is printed as UTC because that is what the wire says. The design
 * shows MST, which would require knowing the recipient's zone; guessing it and
 * labelling the guess is worse than being correct and foreign. When the server
 * sends a localised stamp, render that instead of composing one here.
 */
function describeDelivery(at: string | null): string | null {
  if (at === null) return null;
  const date = formatRecordingDate(at.slice(0, 10));
  if (date === null) return null;
  const time = /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/.exec(at)?.[1];
  return time === undefined
    ? `Delivered ${date}`
    : `Delivered ${date} · ${time} UTC`;
}
