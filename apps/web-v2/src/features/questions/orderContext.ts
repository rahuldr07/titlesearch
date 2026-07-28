/**
 * What the abstractor is signing ABOUT — the order's identity, restated on the
 * sign-off screen.
 *
 * It is repeated here rather than assumed remembered because the answers mean
 * different things per client and per product: the same "yes" against a
 * 40-Year Search and against a Current Owner Search are two different claims,
 * and a person who has lost track of which order this is will sign the wrong
 * one without ever noticing.
 *
 * CONTRACT GAP: no endpoint returns the order's client, product or ordered
 * period for intake. `POST /api/orders` accepts an order and `GET /api/orders/
 * :id/timeline` returns events; neither carries the resolved product period or
 * the client's sign-off policy. Placeholders below.
 */

export const ORDER_CLIENT_NAME = "Sample Client — Riverbend Title";
export const PRODUCT_NAME = "40-Year Search";
export const PERIOD_BADGE = "40-year period · 07/18/1986 – 07/18/2026";

/**
 * The client's list is not the baseline list, and the difference is stated
 * before anyone answers. An abstractor who assumes the standard thirteen will
 * answer a line this client waived and skip one this client added.
 */
export const CLIENT_DIFF_NOTE =
  "This client's list differs from the baseline — 1 line waived, 1 added, 2 scoped.";

/**
 * OPEN RULING Q13 — whether policy may prefill these answers at all is not
 * decided. The design shows the prefill and says plainly what it is not, which
 * is the only version of the feature that is safe to draw either way: a
 * suggestion the person still has to answer past is not a signature, and this
 * copy is what keeps the two from being confused if the ruling lands "yes".
 */
export const POLICY_PREFILL_HEADLINE =
  "Not signed — answers prefilled from client policy.";
export const POLICY_PREFILL_NOTE =
  "Policy can suggest; only a person can sign.";
