import { describe, expect, test } from "vitest";
import { NaReason } from "@titlepipe/contract";
import { noValueFor } from "./FieldValue";
import { naChip } from "./fieldLabel";
import { noValueClasses } from "./NoValue";
import { describeNoValue, NA_REASONS, type NoValueKind } from "./noValueStates";

/**
 * THE GAP THIS FILE CLOSES.
 *
 * `noValueStates.test.ts` tests `describeNoValue(kind)` and
 * `variants.test.ts` tests `noValueClasses({ kind })` — but `kind` is the
 * INPUT to both. Nothing tested the two functions that CHOOSE it from the
 * wire value, so the whole distinction rested on untested code:
 *
 *   `noValueFor(na_reason, page)` → which of the six renders is drawn
 *   `naChip(na_reason)`           → which chip a reviewer reads
 *
 * A mutation audit proved it. Both of these passed 497/497:
 *   fieldLabel   "N/A — DOCUMENT SILENT" → "N/A — NOT FOUND"
 *   FieldValue   NOT_STATED → { kind: "not_found" }
 * because no test or spec anywhere named the strings `DOCUMENT SILENT` or
 * `NOT FOUND`. Only `N/A — EXPECTED` and `PRESENT — UNREADABLE` appeared in
 * any assertion, so two of the four answers were entirely unpinned.
 *
 * CONTEXT §11, release blocker, verbatim: NOT_PRESENT, NOT_FOUND, NOT_STATED
 * and PRESENT_UNREADABLE are four different statements about a document —
 * structurally absent / searched and none of record / returned but silent /
 * on the page and illegible. They must never read as one another, and
 * `pending` (the pipeline has not looked) is a fifth thing again.
 *
 * Node environment, no DOM: this is a static gate, not a rendering test.
 */

interface Expectation {
  /** The render arm `noValueFor` must choose. */
  kind: NoValueKind["kind"];
  /** The exact chip text. Pinned, because a paraphrase is a different answer. */
  chip: string;
  /** The word that identifies THIS answer in the chip and nowhere else. */
  chipWord: RegExp;
  /** The same, for the rendered no-value label. */
  labelWord: RegExp;
}

/**
 * THE MAPPING, PINNED.
 *
 * `satisfies Record<NaReason, …>` is the never-guard: a fifth `NaReason`
 * member is a COMPILE error here, so a new document answer cannot arrive
 * unmapped and quietly render as one of the existing four.
 */
const EXPECTED = {
  NOT_PRESENT: {
    kind: "not_present",
    chip: "N/A — EXPECTED",
    chipWord: /expected/i,
    labelWord: /not used in this jurisdiction/i,
  },
  NOT_FOUND: {
    kind: "not_found",
    chip: "N/A — NOT FOUND",
    chipWord: /not found/i,
    labelWord: /not found/i,
  },
  NOT_STATED: {
    kind: "silent",
    chip: "N/A — DOCUMENT SILENT",
    chipWord: /silent/i,
    labelWord: /silent/i,
  },
  PRESENT_UNREADABLE: {
    kind: "unreadable",
    chip: "PRESENT — UNREADABLE",
    chipWord: /unreadable/i,
    labelWord: /unreadable/i,
  },
} satisfies Record<NaReason, Expectation>;

/** From the contract, never a hand-copied list that can drift out of date. */
const REASONS = NaReason.options;

const PAGE = 30;

describe("every NaReason is mapped, and the table cannot fall behind", () => {
  test("the contract's members and the pinned table are the same set", () => {
    expect([...REASONS].sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  test("the four document answers are exactly the four NA renders", () => {
    const kinds = REASONS.map((reason) => noValueFor(reason, PAGE).kind);
    expect([...kinds].sort()).toEqual([...NA_REASONS].sort());
  });

  test("no reason renders as a PIPELINE state", () => {
    // `pending` and `unsettled` say the pipeline has no answer. An NA reason
    // IS an answer, and drawing one as the other tells a reviewer the opposite
    // of what the document said.
    for (const reason of REASONS) {
      const kind = noValueFor(reason, PAGE);
      expect(describeNoValue(kind).isPipelineState, `${reason} drawn as a pipeline state`).toBe(
        false,
      );
    }
  });
});

describe("noValueFor chooses a DISTINCT render per reason", () => {
  test("each reason maps to its pinned render arm", () => {
    for (const reason of REASONS) {
      expect(noValueFor(reason, PAGE).kind, `${reason} chose the wrong render`).toBe(
        EXPECTED[reason].kind,
      );
    }
  });

  test("no two reasons collapse into one render", () => {
    const kinds = REASONS.map((reason) => noValueFor(reason, PAGE).kind);
    expect(new Set(kinds).size, `two reasons share a render: ${kinds.join(", ")}`).toBe(
      REASONS.length,
    );
  });

  test("only PRESENT_UNREADABLE carries a page — it is the only one on the page", () => {
    const unreadable = noValueFor("PRESENT_UNREADABLE", PAGE);
    expect(unreadable).toEqual({ kind: "unreadable", page: PAGE });
    for (const reason of REASONS.filter((r) => r !== "PRESENT_UNREADABLE")) {
      expect(noValueFor(reason, PAGE), `${reason} must be a bare ${EXPECTED[reason].kind}`).toEqual(
        { kind: EXPECTED[reason].kind },
      );
    }
  });
});

describe("naChip says which answer, in the reviewer's own words", () => {
  test("the exact chip text is pinned per reason", () => {
    for (const reason of REASONS) {
      expect(naChip(reason), `${reason} chip changed`).toBe(EXPECTED[reason].chip);
    }
  });

  test("no two reasons share a chip", () => {
    const chips = REASONS.map(naChip);
    expect(new Set(chips).size, `two reasons share a chip: ${chips.join(" | ")}`).toBe(
      REASONS.length,
    );
  });

  test("a chip never speaks another answer's word", () => {
    // The mutation that survived was "DOCUMENT SILENT" → "NOT FOUND": still
    // distinct from the other three, still a plausible string, and a lie about
    // the document. Distinctness alone does not catch it; anchoring does.
    for (const reason of REASONS) {
      const chip = naChip(reason);
      expect(chip, `${reason} lost its own word`).toMatch(EXPECTED[reason].chipWord);
      for (const other of REASONS.filter((r) => r !== reason)) {
        expect(chip, `${reason} reads as ${other}`).not.toMatch(EXPECTED[other].chipWord);
      }
    }
  });
});

describe("the chip and the render never contradict each other", () => {
  // The chip comes from `naChip`, the body from `noValueFor` + `describeNoValue`.
  // They are two independent switches over the same enum, and a reviewer sees
  // both at once. If they disagree, one of them is lying about the document.
  test("the rendered label carries the same answer as the chip", () => {
    for (const reason of REASONS) {
      const { label, accessibleLabel } = describeNoValue(noValueFor(reason, PAGE));
      for (const text of [label, accessibleLabel]) {
        expect(text, `${reason} lost its own word`).toMatch(EXPECTED[reason].labelWord);
        for (const other of REASONS.filter((r) => r !== reason)) {
          expect(text, `${reason} renders as ${other}`).not.toMatch(EXPECTED[other].labelWord);
        }
      }
    }
  });
});

/**
 * THE GREYSCALE RULE.
 *
 * The design's States Gallery: "They must never collapse into one grey dash."
 * Colour cannot carry that — not for a colour-blind reviewer, and not for the
 * printed abstract, which is monochrome. So the signature below DELIBERATELY
 * discards every colour token and keeps only what survives a photocopier:
 * border presence, border style, fill pattern, whether there is a fill at all,
 * and font weight/style.
 *
 * Note what is NOT here: `bg-na-unreadable-surface` and `bg-surface-app` are
 * two fills that differ only in hue. Comparing those token NAMES would let a
 * pure recolour pass a test whose whole claim is that colour is not the
 * distinction.
 *
 * `border-dotted` and `na-dots` were ADDED with the 2026-08-01 reskin, which is
 * when the grammar first used a dotted stroke (`pending`) and a dot fill
 * (`silent`). Both are exactly what this list says it keeps — a border STYLE
 * and a fill PATTERN, each of which survives a photocopier — and their absence
 * was an accident of the marks that happened to be in use, not a judgement that
 * they are decorative. Leaving them out would have made this test read `pending`
 * and `silent` as the same bare "border" and, worse, would have kept passing if
 * a future edit really did collapse them.
 */
const STRUCTURAL =
  /^(border|border-dashed|border-dotted|border-solid|border-double|border-none|na-hatch|na-dots|italic|not-italic|font-quote|font-mono|font-semibold|font-bold)$/;

function greyscaleSignature(kind: NoValueKind["kind"]): string {
  const classes = noValueClasses({ kind }).split(/\s+/);
  const marks = classes.filter((c) => STRUCTURAL.test(c));
  // Fill PRESENCE, never the fill's hue.
  if (classes.some((c) => c.startsWith("bg-"))) marks.push("filled");
  return marks.sort().join(" ");
}

describe("the renders stay apart in greyscale, not only in colour", () => {
  test("each reason's render differs from every other by more than hue", () => {
    const seen = new Map<string, string>();
    for (const reason of REASONS) {
      const signature = greyscaleSignature(EXPECTED[reason].kind);
      const clash = seen.get(signature);
      expect(
        clash,
        `${reason} and ${clash} differ only in COLOUR (${signature}) — CONTEXT §11: they must never collapse into one grey dash`,
      ).toBeUndefined();
      seen.set(signature, reason);
    }
    expect(seen.size).toBe(REASONS.length);
  });

  test("pending is the fifth thing, and looks like it", () => {
    // `pending` is not an NaReason: the pipeline has not looked. It must not
    // photocopy into any of the four answers.
    const pending = greyscaleSignature("pending");
    for (const reason of REASONS) {
      expect(
        greyscaleSignature(EXPECTED[reason].kind),
        `pending is indistinguishable from ${reason} in greyscale`,
      ).not.toBe(pending);
    }
  });

  test("every render carries at least one non-colour mark", () => {
    // A signature of "" would mean the arm is drawn in colour alone.
    for (const reason of REASONS) {
      expect(greyscaleSignature(EXPECTED[reason].kind), `${reason} is colour-only`).not.toBe("");
    }
  });
});
