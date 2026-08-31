import { describe, expect, test } from "vitest";
import { FOCUSED_ITEM_ROLES, focusOwnsKeys, type FocusTarget } from "./focusOwnership";

/**
 * The rule: a focused control owns the keystroke, and a chord's second key
 * must never also fire a screen action. Checked DOM-free so it runs in the
 * `gates` Vitest project without a browser. The roles below are quoted with
 * the react-aria source that emits them, so a future reader can re-derive
 * the list rather than trust it.
 */

/** A focusable element, without a DOM. `closest` answers for ancestors. */
function focused(role: string | null, ancestorSelectorsMatched: string[] = []): FocusTarget {
  return {
    tagName: "DIV",
    getAttribute: (name: string) => (name === "role" ? role : null),
    closest: ((selector: string) =>
      ancestorSelectorsMatched.some((s) => selector.includes(s))
        ? ({ tagName: "DIV" } as Element)
        : null) as Element["closest"],
  };
}

/** The nine item roles react-aria actually focuses, with the source that emits each. */
const REGRESSION_NINE: ReadonlyArray<readonly [string, string]> = [
  ["option", "useOption.mjs:44 — ListBox/Select/ComboBox items"],
  ["row", "useGridListItem.mjs:274 — GridList/Table rows"],
  ["tab", "useTab.mjs:60 — Tabs"],
  ["menuitemradio", "useMenuItem role= variant"],
  ["menuitemcheckbox", "useMenuItem role= variant"],
  ["radio", "RadioGroup"],
  ["checkbox", "Checkbox"],
  ["switch", "Switch"],
  ["slider", "Slider"],
];

describe("the focusable item roles the widget list must carry", () => {
  test.each(REGRESSION_NINE)("role=%s owns its keys (%s)", (role) => {
    expect(focusOwnsKeys(focused(role))).toBe(true);
  });
});

describe("container roles are matched as ANCESTORS, never by equality", () => {
  /*
   * Focus is on the item, so the container is an ancestor — a test asking
   * "is the active element a listbox" answers no every time.
   */
  test.each(["listbox", "menu", "menubar", "grid", "treegrid", "tree", "radiogroup", "tablist"])(
    "a plain element inside a [role='%s'] stands the global layer down",
    (container) => {
      expect(focusOwnsKeys(focused(null, [`[role='${container}']`]))).toBe(true);
    },
  );

  test("a listbox that is itself focused is still covered", () => {
    // Rare but legal — a listbox with no item focused yet.
    expect(focusOwnsKeys(focused(null, ["[role='listbox']"]))).toBe(true);
  });
});

describe("the tagName half of the prototype's test is kept", () => {
  test.each(["INPUT", "TEXTAREA", "SELECT"])("<%s> owns its keys", (tagName) => {
    const target: FocusTarget = {
      tagName,
      getAttribute: () => null,
      closest: (() => null) as Element["closest"],
    };
    expect(focusOwnsKeys(target)).toBe(true);
  });
});

describe("the extension point", () => {
  test("data-chord-scope='own' stands the global layer down", () => {
    expect(focusOwnsKeys(focused(null, ["[data-chord-scope='own']"]))).toBe(true);
  });

  test("data-chord-scope='widget' stands the global layer down too", () => {
    expect(focusOwnsKeys(focused(null, ["[data-chord-scope='widget']"]))).toBe(true);
  });
});

describe("the two scope values are NOT interchangeable", () => {
  /*
   * `own` is read document-wide by `chords.ts:overlayIsUp` and means "an
   * overlay is up"; `widget` is read only against the focused element's
   * ancestors. An always-present composite marked `own` would make
   * `overlayIsUp()` answer true forever and kill every chord permanently —
   * so composites must use `widget`, and only the overlays may use `own`.
   * The kit spells both through the `chordWidget` / `chordOverlay` constants
   * as well as the literal attribute; matching either form keeps the test
   * honest, and the `toBeGreaterThan(0)` below stops "no marks at all"
   * counting as a pass.
   */
  const ALWAYS_PRESENT = [
    "src/components/ui/tabs.tsx",
    "src/components/ui/table.tsx",
    "src/components/ui/segmented-control.tsx",
  ];

  test.each(ALWAYS_PRESENT)("%s marks itself widget, never own", async (file) => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(file, "utf8");
    const literals = [...source.matchAll(/data-chord-scope="([a-z]+)"/g)].map((m) => m[1]);
    const viaConstant = [...source.matchAll(/\{\.\.\.(chordWidget|chordOverlay)\}/g)].map((m) =>
      m[1] === "chordWidget" ? "widget" : "own",
    );
    const attributes = [...literals, ...viaConstant];
    expect(attributes.length).toBeGreaterThan(0);
    for (const value of attributes) {
      expect(value).toBe("widget");
    }
  });

  test("only the overlays use own", async () => {
    const { readFileSync } = await import("node:fs");
    const OVERLAYS = [
      "src/components/ui/dialog.tsx",
      "src/components/ui/popover.tsx",
      "src/app/keyboard/CommandPalette.tsx",
      // The three cross-cutting overlays; each declares itself through the
      // kit `Dialog`'s `chordOverlay`.
      "src/features/overlays/ShortcutsOverlay.tsx",
      "src/features/overlays/NaGuideOverlay.tsx",
      "src/features/overlays/OrderHistoryOverlay.tsx",
    ];
    for (const file of OVERLAYS) {
      const source = readFileSync(file, "utf8");
      const owns =
        source.includes('data-chord-scope="own"') ||
        source.includes("{...chordOverlay}") ||
        // …or it composes the kit `Dialog`, which spreads `chordOverlay`
        // itself — the mark is one file away, not absent. A screen that
        // hand-rolls a scrim instead still fails, which is the clause that
        // matters.
        (source.includes("<Dialog") && source.includes("components/ui"));
      expect(owns).toBe(true);
    }
  });
});

describe("what does NOT own keys", () => {
  /*
   * The other half of the rule, and the reason this is not just "return
   * true": a chord layer that never fires is as broken as one that always
   * does.
   */
  test("nothing focused", () => {
    expect(focusOwnsKeys(null)).toBe(false);
  });

  test.each(["button", "link", "heading", "img", "main", "navigation", null])(
    "role=%s does not suppress a chord",
    (role) => {
      expect(focusOwnsKeys(focused(role))).toBe(false);
    },
  );
});

describe("the role table itself", () => {
  test("every focusable item role is present in FOCUSED_ITEM_ROLES", () => {
    for (const [role] of REGRESSION_NINE) {
      expect(FOCUSED_ITEM_ROLES.has(role)).toBe(true);
    }
  });

  test("gridcell and row are BOTH present", () => {
    // useGridListItem defaults to focusMode: 'row'; both are focusable
    // depending on that setting.
    expect(FOCUSED_ITEM_ROLES.has("gridcell")).toBe(true);
    expect(FOCUSED_ITEM_ROLES.has("row")).toBe(true);
  });

  test("menuitem and both of its role variants are present", () => {
    expect(FOCUSED_ITEM_ROLES.has("menuitem")).toBe(true);
    expect(FOCUSED_ITEM_ROLES.has("menuitemradio")).toBe(true);
    expect(FOCUSED_ITEM_ROLES.has("menuitemcheckbox")).toBe(true);
  });

  test("CONTAINER roles are not in the item table — they cannot hold focus", () => {
    for (const container of ["listbox", "menu", "grid", "tree", "tablist", "radiogroup"]) {
      expect(FOCUSED_ITEM_ROLES.has(container)).toBe(false);
    }
  });
});
