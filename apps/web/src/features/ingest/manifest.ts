import type { CreateOrderRequest } from "@titlepipe/contract";

/**
 * THE FIVE ORDER FIELDS AND WHY EACH ONE MUST EXIST — the label and reason the
 * form prints beside every input, for the operator filling it in.
 *
 * THIS IS NOT THE MISSING-FIELD LIST. INVARIANTS 60-61: the SERVER names what
 * is missing and the client does not author that list, so this table is never
 * consulted to decide. A key the server names and this table does not know
 * still renders, as itself; a key this table knows and the server did not name
 * never appears at all.
 *
 * The keys are `CreateOrderRequest`'s (endpoints.ts:39), typed against it so a
 * contract rename is a compile error rather than a label that stops matching.
 */
export interface ManifestEntry {
  readonly key: keyof CreateOrderRequest;
  /** The design's label. Mono, because it names a data key (rule 3). */
  readonly label: string;
  readonly why: string;
}

/* Row order follows the reference's Order Configuration column: client first,
   then the client's own order number. The three the reference does not draw
   writable (jurisdiction/state/county) follow — see
   docs/frontend/design-2026-08/CONFLICT-intake-hand-typed-jurisdiction.md. */
export const MANIFEST: readonly ManifestEntry[] = [
  {
    key: "client_id",
    label: "CLIENT",
    why: "Decides delivery and which sign-off checklist resolves.",
  },
  {
    key: "external_ref",
    label: "CLIENT ORDER #",
    why: "Identity — nothing else ties this file to anything.",
  },
  {
    key: "jurisdiction",
    label: "JURISDICTION",
    why: "Decides which extraction setup reads this county's documents.",
  },
  {
    key: "state",
    label: "STATE",
    why: "Some house rules apply only in certain states — the state picks them.",
  },
  {
    key: "county",
    label: "COUNTY",
    why: "Follow the land — property and recording county, never the notary's.",
  },
];

/**
 * The gloss for one server-named key, or null when this screen has nothing to
 * add. `package` is not a `CreateOrderRequest` member — it is the multipart
 * file part (endpoints.ts:57) — so it is answered here rather than by widening
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
