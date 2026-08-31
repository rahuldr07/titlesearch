import type { CreateOrderRequest } from "@titlepipe/contract";

/**
 * The label and reason the refused card prints beside every key the server
 * names. This is not the missing-field list: the server names what is missing,
 * and this table is never consulted to decide. A key the server names and this
 * table does not know still renders, as itself; a key this table knows and the
 * server did not name never appears at all. Keys are typed against
 * `CreateOrderRequest` so a contract rename is a compile error.
 */
export interface ManifestEntry {
  readonly key: keyof CreateOrderRequest;
  /** Mono, because it names a data key. */
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
 * file part — so it is answered here rather than by widening the table above
 * to a union the contract does not have.
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
