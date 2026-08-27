import type { CreateOrderRequest } from "@titlepipe/contract";

/**
 * THE FIVE ORDER FIELDS AND WHY EACH ONE MUST EXIST.
 *
 * ══ THIS IS NOT THE MISSING-FIELD LIST ══════════════════════════════════════
 *
 * INVARIANTS 60-61: an incomplete upload renders THE SERVER'S missing-field
 * list verbatim; the client does not author the list. So this table is not
 * consulted to decide what is missing — the server names that, and
 * `RefusedCard` prints the server's key verbatim beside whatever gloss is
 * found here. A key the server names and this table does not know still
 * renders, as itself. A key this table knows and the server did not name never
 * appears at all.
 *
 * What it IS: the design's right column, which prints a label and a reason
 * beside every input. Those are the screen's own words for the operator
 * filling the form, and they exist because a package missing its order
 * identity does not fail at upload — it fails four stages later, silently, as
 * a wrong value on a delivered report.
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

export const MANIFEST: readonly ManifestEntry[] = [
  {
    key: "external_ref",
    label: "ORDER #",
    why: "Identity — nothing else ties this file to anything.",
  },
  {
    key: "client_id",
    label: "CLIENT",
    why: "Decides delivery and which sign-off checklist resolves.",
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
