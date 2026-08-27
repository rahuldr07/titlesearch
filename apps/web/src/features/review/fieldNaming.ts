import type { Field } from "@titlepipe/contract";

/**
 * THE PATH, MADE READABLE — AND NOTHING ELSE.
 *
 * A field path (`mortgages.1.lender`) is the server's identifier. This file
 * renders it as words ("MTG 1 — LENDER") and does not add, infer or decide a
 * single thing beyond that: no state, no ordering, no grouping the server did
 * not already express in the path it sent.
 *
 * ══ WHY THIS IS NOT A CLIENT-SIDE RULEBOOK ═════════════════════════════════
 *
 * Hard rule 3 puts state machines and thresholds on the server, and this is
 * neither. It is a TRANSLITERATION: every character out comes from a character
 * in. A lookup table of pretty names would be the other thing — a second copy
 * of the field vocabulary that drifts the moment the pipeline adds a section —
 * so there is no table. `mortgages` shortens to `MTG` and `judgments` to
 * `JGMT` because the row label column is 140px and the design draws the
 * abbreviations; every other section passes through as itself.
 *
 * ══ WHY THE LABEL IS ALL-CAPS, WHICH RULE 4 OTHERWISE FORBIDS ══════════════
 *
 * Rule 4 is sentence case everywhere, ALL-CAPS only for sidebar rubrics and
 * serif certificate headings. A field path is neither — but it is also not
 * PROSE. It is an identifier, and rule 3 puts identifiers in mono. The design
 * draws this column as a mono rubric at 11px, which is the rubric register
 * rule 4 permits, and the caps are what stop `deed.book_page` reading as a
 * sentence somebody wrote. FLAGGED rather than silently absorbed: if the owner
 * rules sentence case here, it changes in this one function.
 */

/** The sections that get a short form, because 140px is 140px. */
const SHORT: Readonly<Record<string, string>> = {
  mortgages: "MTG",
  judgments: "JGMT",
  assessment: "TAX",
};

/**
 * `owner.zip` → `OWNER ZIP`. `mortgages.1.lender` → `MTG 1 — LENDER`.
 *
 * The dash appears only where the path carries an INSTANCE NUMBER, because
 * that is the only place there are two things to separate: which mortgage, and
 * which part of it.
 */
export function fieldLabel(path: string): string {
  const parts = path.split(".");
  const head = parts[0] ?? path;
  const section = (SHORT[head] ?? head).toUpperCase();
  const rest = parts.slice(1);
  const index = rest[0] !== undefined && /^\d+$/.test(rest[0]) ? rest[0] : null;
  const name = (index === null ? rest : rest.slice(1)).join(" ").replace(/_/g, " ");
  const leaf = name.toUpperCase();
  return index === null ? `${section} ${leaf}` : `${section} ${index} — ${leaf}`;
}

/**
 * THE SECTION A FIELD BELONGS TO — the path's first segment, and only that.
 *
 * ONE FUNCTION, TWO CONSUMERS. The section rail and the field list both call
 * it, so a rail link and the heading it names cannot drift into two different
 * splits — that drift is exactly what `review.spec`'s section-rail test pins,
 * and rule 11 ("one variable, never two literals") is the same rule stated
 * generally.
 */
export function sectionOf(path: string): string {
  return path.split(".")[0] ?? path;
}

/** The section's own heading. Sentence case (rule 4) — this one IS prose. */
export function sectionTitle(section: string): string {
  return section.charAt(0).toUpperCase() + section.slice(1).replace(/_/g, " ");
}

export type Section = {
  readonly id: string;
  readonly title: string;
  readonly fields: readonly Field[];
  /** Whether the SERVER has anything queued here. Read, never computed. */
  readonly flagged: boolean;
};

/**
 * Group the server's fields into sections, in the order the server sent them.
 *
 * NOT SORTED BY ANYTHING. The array order is the pipeline's, and re-ordering it
 * by state or by name would be the browser deciding what a reviewer meets
 * first. `flagged` records whether a section holds queued work; the SCREEN
 * decides whether to float those to the top, because that is a view preference
 * the design gives a toggle for.
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
