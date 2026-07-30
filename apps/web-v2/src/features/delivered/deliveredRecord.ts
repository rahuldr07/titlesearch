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
 * to select. IT SELECTS ON `delivered_at`, NOT ON `version`. Version numbers are
 * only comparable inside one order — a v2 of order B is not "newer" than a v1 of
 * order A, it is a different order's second attempt — and ranking the whole list
 * by version made the order-less route confirm whichever order in the system had
 * most recently gone wrong. The design's Delivered screen is a receipt for the
 * last thing that landed, so "last thing that landed" is what this reads.
 *
 * Version still decides ties INSIDE an order, where it means what it says, and
 * the number itself is never computed here: `report.version` is the server's,
 * and a v2 exists on screen only because the server issued one.
 *
 * A TIE BETWEEN TWO DIFFERENT ORDERS IS NOT BROKEN BY VERSION. Ranking by
 * `delivered_at` fixed the ordering but left the tie-break comparing v2-of-B
 * against v1-of-A — the same incomparable pair, one line further down — and the
 * fixture delivers both demo orders on the same stamp, so the order-less route
 * opened on the amended sheet every time. Anyone reaching `/delivered` met the
 * exception (REISSUED · v2, a disputed field struck through) instead of the
 * case, which is the screen arguing that reissues are what delivery looks like.
 * On a cross-order tie the incumbent stands, so the server's own list order
 * decides — an arbitrary rule the server owns beats a wrong one we invent.
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
  // ISO-8601 UTC sorts lexicographically, so the comparison needs no `Date`.
  let bestAt = "";

  for (const d of deliveries) {
    if (d.status !== "delivered") continue;
    const report = d.report;
    if (!report) continue;
    if (orderId !== undefined && report.order_id !== orderId) continue;

    // A delivered row with no timestamp sorts oldest rather than being dropped:
    // it did land, and a missing stamp is the server's gap, not a disqualifier.
    const at = d.delivered_at ?? "";
    if (best !== null && at < bestAt) continue;
    if (best !== null && at === bestAt) {
      // Same instant: only a later version OF THE SAME ORDER supersedes.
      if (report.order_id !== best.orderId) continue;
      if (report.version <= best.version) continue;
    }

    best = {
      orderId: report.order_id,
      version: report.version,
      deliveredLabel: describeDelivery(d.delivered_at),
    };
    bestAt = at;
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
