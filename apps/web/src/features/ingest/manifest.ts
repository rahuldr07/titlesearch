import type { CreateOrderRequest } from "@titlepipe/contract";

/**
 * THE ORDER FIELDS AND WHY EACH ONE MUST EXIST — the label and reason the
 * refused card prints beside every key the server names.
 *
 * THIS IS NOT THE MISSING-FIELD LIST. INVARIANTS 60-61: the SERVER names what
 * is missing and the client does not author that list, so this table is never
 * consulted to decide. A key the server names and this table does not know
 * still renders, as itself; a key this table knows and the server did not name
 * never appears at all.
 *
 * ⚠ AMENDED 2026-08-29 (RULING-2026-08-29.md): jurisdiction, state and county
 * LEFT this table with `CreateOrderRequest` — the server resolves them from
 * the recorded clerk stamp, so there is no input for a refusal to point at —
 * and `product` joined it. The keys are `CreateOrderRequest`'s (endpoints.ts),
 * typed against it so a contract rename is a compile error rather than a
 * label that stops matching.
 */
export interface ManifestEntry {
  readonly key: keyof CreateOrderRequest;
  /** The design's label. Mono, because it names a data key (rule 3). */
  readonly label: string;
  readonly why: string;
}

export const MANIFEST: readonly ManifestEntry[] = [
  {
    key: "client_id",
    label: "CLIENT",
    why: "Decides delivery and the first half of the sign-off checklist key.",
  },
  {
    key: "product",
    label: "PRODUCT",
    why: "The second half of the checklist key — what was ordered, over what span.",
  },
  {
    key: "external_ref",
    label: "CLIENT ORDER #",
    why: "Identity — nothing else ties this file to anything.",
  },
];

/**
 * The gloss for one server-named key, or null when this screen has nothing to
 * add. `package` is not a `CreateOrderRequest` member — it is the multipart
 * file part (endpoints.ts) — so it is answered here rather than by widening
 * the table above to a union the contract does not have.
 */
export function glossFor(
  serverKey: string,
): { readonly label: string; readonly why: string } | null {
  const entry = MANIFEST.find((m) => m.key === serverKey);
  if (entry !== undefined) return { label: entry.label, why: entry.why };
  if (serverKey === "package") {
    return {
      label: "PACKAGE",
      why: "The search package itself — there is nothing to extract without it.",
    };
  }
  return null;
}
