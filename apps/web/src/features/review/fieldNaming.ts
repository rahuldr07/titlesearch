import type { Field } from "@titlepipe/contract";

/**
 * The path, made readable — and nothing else. A field path
 * (`mortgages.1.lender`) is the server's identifier.
 */

/** The sections that get a short form, because 140px is 140px. */
const SHORT: Readonly<Record<string, string>> = {
  mortgages: "MTG",
  judgments: "JGMT",
  assessment: "TAX",
};

/** `owner.zip` → `OWNER ZIP`. `mortgages.1.lender` → `MTG 1 — LENDER`. */
export function fieldLabel(path: string): string {
  const parts = path.split(".");
  const head = parts[0] ?? path;
  /* The head is humanised the same way the leaf is: a section path is a
     snake_case identifier (`deed_of_trust`), and printing it raw put
     "DEED_OF_TRUST GRANTOR" on the row while the section heading above it
     already read "Deed of trust". */
  const section = (SHORT[head] ?? head.replace(/_/g, " ")).toUpperCase();
  const rest = parts.slice(1);
  const index = rest[0] !== undefined && /^\d+$/.test(rest[0]) ? rest[0] : null;
  const name = (index === null ? rest : rest.slice(1)).join(" ").replace(/_/g, " ");
  /* A leaf may already open with the word the section abbreviates
     (`assessment.tax_status`). Drop the repeat, but only while a word
     survives it. */
  const words = name.toUpperCase().split(" ");
  const leaf = (words[0] === section && words.length > 1 ? words.slice(1) : words).join(" ");
  return index === null ? `${section} ${leaf}` : `${section} ${index} — ${leaf}`;
}

/** The section a field belongs to — the path's first segment, only. */
function sectionOf(path: string): string {
  return path.split(".")[0] ?? path;
}

/** The section's own heading. Sentence case — this one is prose. */
function sectionTitle(section: string): string {
  return section.charAt(0).toUpperCase() + section.slice(1).replace(/_/g, " ");
}

export type Section = {
  readonly id: string;
  readonly title: string;
  readonly fields: readonly Field[];
  /** Whether the server has anything queued here. Read, never computed. */
  readonly flagged: boolean;
};

/**
 * Group the server's fields into sections, in the order the server sent
 * them. Not sorted by anything.
 */
export function sectionsOf(
  fields: readonly Field[],
  isQueued: (field: Field) => boolean,
): readonly Section[] {
  const order: string[] = [];
  const byId = new Map<string, Field[]>();

  for (const field of fields) {
    const id = sectionOf(field.path);
    const bucket = byId.get(id);
    if (bucket === undefined) {
      order.push(id);
      byId.set(id, [field]);
    } else {
      bucket.push(field);
    }
  }

  return order.map((id) => {
    const group = byId.get(id) ?? [];
    return {
      id,
      title: sectionTitle(id),
      fields: group,
      flagged: group.some(isQueued),
    };
  });
}
