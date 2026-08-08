import { describe, expect, test } from "vitest";
import { buttonClasses } from "./buttonClasses";
import { cardClasses, type CardTone } from "./Card";
import { noValueClasses } from "../../entities/field/NoValue";

/**
 * These exist because a mutation audit killed nothing.
 *
 * Six plausible bugs were injected and the suite reported 141/141 passing on
 * every one. Two of them lived here: deleting every `disabled:` class from
 * Button, and collapsing all six no-value renders into one identical grey.
 * The second is the CONTEXT §11 release blocker verbatim — "they must never
 * collapse into one grey dash" — and nothing noticed, because the ten existing
 * no-value tests assert the STRINGS in `describeNoValue`, never the RENDER.
 *
 * A `cva` config is a pure function from variant to class list. Testing it in
 * node needs no DOM and catches exactly the class of regression that slipped
 * through: styling logic silently losing a distinction.
 *
 * What this cannot do is prove the classes have the intended VISUAL effect —
 * that is axe's job on the Storybook run, and the two are complements.
 */

const NA_KINDS = [
  "pending",
  "unsettled",
  "not_present",
  "not_found",
  "silent",
  "unreadable",
] as const;

describe("the six no-value renders never collapse", () => {
  test("every kind produces a DIFFERENT class list", () => {
    const seen = new Map<string, string>();
    for (const kind of NA_KINDS) {
      const classes = noValueClasses({ kind });
      const clash = seen.get(classes);
      expect(
        clash,
        `${kind} renders identically to ${clash} — CONTEXT §11: they must never collapse into one grey dash`,
      ).toBeUndefined();
      seen.set(classes, kind);
    }
    expect(seen.size).toBe(NA_KINDS.length);
  });

  test("the distinction survives greyscale — each differs by more than colour", () => {
    // Colour alone fails for colour-blind and greyscale-printed readers, so
    // every kind must also differ in border-style or fill pattern.
    //
    // The filter deliberately keeps NO colour token. It used to keep `bg-`,
    // which made this test — the one whose whole claim is that colour is not
    // the distinction — pass on `bg-surface-app` vs `bg-na-unreadable-surface`,
    // two fills that differ only in hue. Fill PRESENCE is structural; the
    // fill's colour is not.
    const structural = (kind: (typeof NA_KINDS)[number]) => {
      const classes = noValueClasses({ kind }).split(/\s+/);
      const marks = classes.filter((c) =>
        /^(border|border-dashed|border-solid|border-double|border-none|na-hatch|italic|not-italic|font-quote|font-mono|font-semibold|font-bold)$/.test(
          c,
        ),
      );
      if (classes.some((c) => c.startsWith("bg-"))) marks.push("filled");
      return marks.sort().join(" ");
    };

    // not_present is dashed, silent is hatched, unreadable is tinted — the
    // three that must never be mistaken for one another.
    expect(structural("not_present")).not.toBe(structural("not_found"));
    expect(structural("silent")).not.toBe(structural("not_found"));
    expect(structural("unreadable")).not.toBe(structural("not_found"));
  });

  test("the two pipeline states are not styled as NA states", () => {
    // pending and unsettled say "no answer yet", not "the document says no".
    for (const kind of ["pending", "unsettled"] as const) {
      expect(noValueClasses({ kind })).toContain("state-attend");
    }
    for (const kind of ["not_present", "not_found", "silent"] as const) {
      expect(noValueClasses({ kind })).not.toContain("state-attend");
    }
  });
});

describe("Button's disabled treatment is a surface swap, never opacity", () => {
  test("every variant carries the disabled classes", () => {
    // Deleting these was mutation M4 and nothing failed. The design's rule is
    // that disabled swaps surface/ink/border; opacity means something else
    // entirely here (permission-denied and retired).
    for (const fill of ["solid", "outlined", "tinted", "ghost"] as const) {
      const classes = buttonClasses({ fill, tone: "neutral" });
      expect(classes, `${fill} lost disabled:bg`).toContain("disabled:bg-surface-app");
      expect(classes, `${fill} lost disabled:text`).toContain(
        "disabled:text-ink-muted",
      );
      expect(classes, `${fill} lost the cursor`).toContain(
        "disabled:cursor-not-allowed",
      );
    }
  });

  test("disabled never uses opacity", () => {
    for (const fill of ["solid", "outlined", "tinted", "ghost"] as const) {
      expect(buttonClasses({ fill })).not.toMatch(/disabled:opacity/);
    }
  });

  test("each tone/fill pair is visually distinct", () => {
    const seen = new Set<string>();
    for (const fill of ["solid", "outlined", "tinted"] as const) {
      for (const tone of ["action", "settled", "attend", "halt"] as const) {
        const c = buttonClasses({ fill, tone });
        expect(seen.has(c), `${fill}/${tone} duplicates another variant`).toBe(false);
        seen.add(c);
      }
    }
  });

  test("the design's transition-free rule holds", () => {
    expect(buttonClasses({})).toContain("transition-none");
  });
});

const CARD_TONES = ["none", "action", "attend", "halt", "settled"] as const;

/** The token family each tone draws from — the ground and hairline must agree. */
const FAMILY: Record<Exclude<CardTone, "none">, string> = {
  action: "action",
  attend: "state-attend",
  halt: "state-halt",
  settled: "state-settled",
};

describe("Card's ground and its stripe are separate axes", () => {
  test("every tone produces a DIFFERENT class list", () => {
    const seen = new Map<string, string>();
    for (const tone of CARD_TONES) {
      const classes = cardClasses({ tone });
      const clash = seen.get(classes);
      expect(clash, `tone=${tone} renders identically to ${clash}`).toBeUndefined();
      seen.set(classes, tone);
    }
    expect(seen.size).toBe(CARD_TONES.length);
  });

  test("a tone's ground and hairline come from the same family", () => {
    // The failure this catches is the one the export already has 34 times:
    // a pale `-surface` ground fenced by the SATURATED base colour, so the
    // same meaning is drawn at two hairline strengths.
    for (const [tone, family] of Object.entries(FAMILY)) {
      const classes = cardClasses({ tone: tone as CardTone });
      expect(classes, `${tone} lost its ground`).toContain(`bg-${family}-surface`);
      expect(classes, `${tone} lost its hairline`).toContain(`border-${family}-border`);
      expect(classes, `${tone} kept the neutral panel`).not.toContain(
        "bg-surface-panel",
      );
    }
    expect(cardClasses({ tone: "none" })).toContain("bg-surface-panel");
  });

  /*
   * UPDATED 2026-08-01 with the palette revaluation. The neutral card used to
   * assert `border-line-strong`; the approved mockup separates containers with
   * DEPTH and keeps hairlines for interior divisions only, so that expectation
   * now describes a card the design does not draw. The claim is not weakened —
   * it is inverted and still pinned: the neutral card must carry the shadow and
   * must NOT carry a neutral outer hairline.
   */
  test("a neutral card is separated by depth, never by an outer hairline", () => {
    expect(cardClasses({ tone: "none" })).toContain("shadow-card");
    expect(cardClasses({ tone: "none" })).not.toMatch(/\bborder-line-/);
    expect(cardClasses({ size: "emphasis" })).toContain("shadow-pop");
    // An inner well never floats — it takes the mockup's inset hairline instead.
    expect(cardClasses({ size: "nested" })).not.toMatch(/\bshadow-/);
    expect(cardClasses({ size: "nested" })).toContain("inset-ring-line-subtle");
  });

  test("accent draws a TOP stripe and never a left edge", () => {
    // The whole point of the correction: the left edge is the SEVERITY axis
    // (4px, banners). A card wearing it competes for alarm with real banners.
    for (const accent of CARD_TONES) {
      const classes = cardClasses({ accent });
      if (accent === "none") {
        expect(classes).not.toContain("border-t-(length:--stroke-accent)");
        continue;
      }
      expect(classes, `${accent} lost the top stripe`).toContain(
        "border-t-(length:--stroke-accent)",
      );
      expect(classes, `${accent} drew a left edge`).not.toMatch(/border-l-[a-z(]/);
      expect(classes, `${accent} used the severity stroke`).not.toContain(
        "--stroke-severity",
      );
    }
  });

  test("settled takes a stripe — live and alarming are different claims", () => {
    expect(cardClasses({ accent: "settled" })).toContain("border-t-state-settled");
  });

  test("tone and accent stay independent — a tinted card can carry any stripe", () => {
    const seen = new Set<string>();
    for (const tone of CARD_TONES) {
      for (const accent of CARD_TONES) {
        const c = cardClasses({ tone, accent });
        expect(
          seen.has(c),
          `tone=${tone}/accent=${accent} duplicates another pair`,
        ).toBe(false);
        seen.add(c);
      }
    }
  });

  test("dashed swaps the hairline to dashed — provisional is not evidence", () => {
    expect(cardClasses({ dashed: true })).toContain("border-dashed");
    expect(cardClasses({ dashed: false })).not.toContain("border-dashed");
    expect(cardClasses({})).not.toContain("border-dashed");
  });
});
