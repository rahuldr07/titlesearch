import { describe, expect, test } from "vitest";
import { FOCUSED_ITEM_ROLES, focusOwnsKeys } from "./focusOwnership";

/**
 * [INVARIANT 49/50/51] — rule: a focused control owns the keystroke, and a
 * chord's second key must never ALSO fire a screen action (ORPHAN O15, "what
 * stops a stray keystroke destroying an in-progress correction").
 *
 * THIS TEST EXISTS BECAUSE THE CLAIM DID NOT HAVE ONE. REVIEW-01 B3: the
 * chord header asserted that `role` covered the react-aria composites, and
 * nine of nine roles react-aria actually focuses walked past. The only cited
 * proof was a Playwright spec that needs a screen which has not landed. So the
 * rule gets a check that runs today, DOM-free, in the `gates` project.
 *
 * The nine below are quoted with the react-aria source that emits them, so a
 * future reader can re-derive the list rather than trust it.
 */

/** A focusable element, without a DOM. `closest` answers for ancestors. */
function focused(role: string | null, ancestorSelectorsMatched: string[] = []): Element {
  return {
    tagName: "DIV",
    getAttribute: (name: string) => (name === "role" ? role : null),
    closest: (selector: string) =>
      ancestorSelectorsMatched.some((s) => selector.includes(s)) ? ({} as Element) : null,
  } as unknown as Element;
}

/** The nine REVIEW-01 proved missing, with the source that emits each. */
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

describe("the nine roles REVIEW-01 B3 proved missing", () => {
  test.each(REGRESSION_NINE)("role=%s owns its keys (%s)", (role) => {
    expect(focusOwnsKeys(focused(role))).toBe(true);
  });
});

describe("container roles are matched as ANCESTORS, never by equality", () => {
  /*
   * The B3 half that is easy to get wrong twice. Focus is on the ITEM, so the
   * container is an ancestor. A test asking "is the active element a listbox"
   * answers no every time, which is precisely why the old list never fired.
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
    expect(focusOwnsKeys({ tagName, getAttribute: () => null, closest: () => null } as unknown as Element)).toBe(true);
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
   * The near-miss while fixing B3, pinned so it cannot come back.
   *
   * `own` is read DOCUMENT-WIDE by `chords.ts:overlayIsUp` and means "an
   * overlay is up". `widget` is read only against the focused element's
   * ancestors. A Tabs strip or a Checkbox is in the document at all times, so
   * marking one `own` would make `overlayIsUp()` answer true forever and kill
   * every chord in the app permanently.
   *
   * So: the always-present composites must use `widget`, and only the four
   * overlays may use `own`.
   */
  const ALWAYS_PRESENT = [
    "src/components/ui/Tabs.tsx",
    "src/components/ui/DataTable.tsx",
    "src/components/ui/SegmentedControl.tsx",
    "src/components/ui/RadioGroup.tsx",
    "src/components/ui/Checkbox.tsx",
    "src/components/ui/Switch.tsx",
  ];

  test.each(ALWAYS_PRESENT)("%s marks itself widget, never own", async (file) => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(file, "utf8");
    const attributes = [...source.matchAll(/data-chord-scope="([a-z]+)"/g)].map((m) => m[1]);
    expect(attributes.length).toBeGreaterThan(0);
    for (const value of attributes) {
      expect(value).toBe("widget");
    }
  });

  test("only the overlays use own", async () => {
    const { readFileSync } = await import("node:fs");
    const OVERLAYS = [
      "src/components/ui/Dialog.tsx",
      "src/components/ui/Popover.tsx",
      "src/app/keyboard/CommandPalette.tsx",
      "src/app/keyboard/KeyMap.tsx",
    ];
    for (const file of OVERLAYS) {
      const source = readFileSync(file, "utf8");
      expect(source).toContain('data-chord-scope="own"');
    }
  });
});

describe("what does NOT own keys", () => {
  /*
   * The other half of the rule, and the reason this is not just "return true".
   * A chord layer that never fires is as broken as one that always does, and
   * this project has already shipped a chord that silently did nothing.
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
  test("every role REVIEW-01 named is present in FOCUSED_ITEM_ROLES", () => {
    for (const [role] of REGRESSION_NINE) {
      expect(FOCUSED_ITEM_ROLES.has(role)).toBe(true);
    }
  });

  test("gridcell and row are BOTH present", () => {
    // The old list had gridcell and not row, while useGridListItem defaults to
    // focusMode: 'row'. Both are focusable depending on that setting.
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
