import type { GoldenTag } from "@titlepipe/contract";
import { StatusMark, type Mark } from "../../components/ui";

/**
 * WHAT A SEED'S TAG MEANS, IN WORDS, ON THE ROW.
 *
 * `GoldenTag` (enums.ts:88) has four members and they are not four flavours of
 * "verified". They are four DIFFERENT CLAIMS about where a row's value came
 * from, and CONTEXT §420 is blunt about why the difference is the whole point:
 *
 *   > Be honest about what the seed is: it is anchored on TYPIST BEHAVIOUR,
 *   > NOT TRUTH. It cannot measure what typists get wrong systematically —
 *   > judgment TYPE was wrong 3/3, and a seed built from these reports will
 *   > happily score a model that reproduces the error. Tag it
 *   > `source: 'delivered_report'` alongside `agreed` and `ruled` so nobody
 *   > mistakes it later.
 *
 * "So nobody mistakes it later" is a rendering requirement. A four-way tag
 * drawn as four coloured chips is exactly the mistake: the reader learns a
 * palette, not a provenance. So each tag prints the CLAIM in a sentence, and
 * the mark is the second carrier rather than the only one.
 *
 * ══ A `Record` OVER THE FROZEN ENUM ════════════════════════════════════════
 *
 * Same construction as `fieldValue.ts`'s `NA_KIND`: a fifth tag added to
 * `enums.ts` fails to compile HERE, in one place, rather than falling through
 * to a default that quietly renders it as one of the four. A `default:` branch
 * on a taxonomy this load-bearing is how a fifth provenance class ends up
 * looking like a fourth.
 *
 * ══ RULE 6: ONE SIGNAL PER ROW, AND IT IS NOT A CAPSULE ════════════════════
 *
 * `StatusMark` rather than `Badge`. Rule 6 spends the tinted capsule only at
 * moments of record — released, quarantine clear, T1 — and a corpus census is a
 * list of records, not a moment of one. The glyph, the weight and the words all
 * differ per tag, so this survives greyscale and a red-green deficiency.
 */

type SeedTagRender = {
  /** Rule 7's closed glyph vocabulary — ✓ ◆ • and nothing else here. */
  readonly mark: Mark;
  /** What the tag CLAIMS, sentence case, in the words a reader can act on. */
  readonly label: string;
  /** The limit of that claim. Never omitted — a claim with no limit is a boast. */
  readonly caveat: string;
};

const SEED_TAG: Readonly<Record<GoldenTag, SeedTagRender>> = {
  delivered_report: {
    mark: "attend",
    label: "Read off a delivered report",
    caveat:
      "Anchored on typist behaviour, not on truth — nobody has verified this against the document (CONTEXT §12).",
  },
  ruled: {
    mark: "settled",
    label: "Ruled by a person",
    caveat:
      "Human-verified against a cited source, and the act that verified it is on the record below.",
  },
  suspect: {
    mark: "halt",
    label: "Suspect",
    caveat:
      "A diagnosis, not a failure: the document is ambiguous and neither reading is defensible (PRD §12).",
  },
  agreed: {
    mark: "settled",
    label: "Both readings agreed",
    caveat:
      "Two independent reads matched. Agreement is corroboration, not verification — neither read was a person.",
  },
};

export function SeedTagMark(props: { readonly tag: GoldenTag }) {
  const render = SEED_TAG[props.tag];
  return (
    <StatusMark
      mark={render.mark}
      label={render.label}
      /* A ✓ on a row nobody is being asked to act on is desaturated, not
         hidden — the two settled tags are the resting state of this corpus. */
      resting={render.mark === "settled"}
    />
  );
}

/** The limit of the claim, as prose. Drawn under the value, not in a tooltip. */
export function SeedTagCaveat(props: { readonly tag: GoldenTag }) {
  return (
    <p className="font-sans text-label leading-body text-ink-muted">
      {SEED_TAG[props.tag].caveat}
    </p>
  );
}
