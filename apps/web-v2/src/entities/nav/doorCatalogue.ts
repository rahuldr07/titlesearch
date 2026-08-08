/**
 * EVERY DOOR THE APP HAS, and the mark and chord each one carries. Data only —
 * who may open what lives in `doors.ts`, which is the single reader of `DOORS`.
 *
 * `label` is what the `?` key map prints, and it is load-bearing: `roles.spec`
 * asserts a typist's map does NOT contain "escalation inbox" or "readout". It is
 * stored lowercase because it is also spoken inside the map's sentences; only
 * the rail titles it (`RailRow`).
 *
 * `group` decides which of the rail's sections draws a door (Task 12):
 * `work` / `admin` / `reference` render as a plain labelled list; `this-order`
 * doors are drawn by `LifecycleRail` instead (the numbered pipeline), never that
 * list, so `group` is metadata for the RENDERER to route on, not a second source
 * of the door set. `account` renders in NEITHER — the design does not draw
 * Profile as a rail door (it lives in the account menu), and no test requires it
 * in the rail, so it stays here for the chord and the `?` map only.
 *
 * THE MARK IS A STORED ICON, reversing the derived initial that `glyphs.ts` used
 * to resolve. The short version: an icon is not derivable from a label (`⌂` is
 * not a fact about the string "clients"), so there is nothing for it to drift
 * from — which was the whole objection to storing the old LETTER. What a mark
 * can still do is COLLIDE, and that is the requirement that actually mattered,
 * because at 78px the mark is the only thing a door row draws. `doors.test.ts`
 * gates it directly and carries the full history of both rulings.
 */
export type DoorGroup = "work" | "this-order" | "admin" | "reference" | "account";

export interface Door {
  path: string;
  /** Chord second key: `g` then this. */
  key: string;
  label: string;
  group: DoorGroup;
  /**
   * The rail's mark. Required on every door the rail draws (`isRailDoor`) and
   * unique among them — both gated by `doors.test.ts`. A `this-order` door is
   * drawn numbered by `LifecycleRail` and an `account` door is not drawn at all,
   * so neither carries one.
   */
  icon?: string;
}

/*
 * The icons are the mockup's where the mockup draws the door, and chosen in its
 * vocabulary where it does not (it draws seven of the nine). They are geometric
 * pictographs rather than a pictorial icon set on purpose: at 11px on warm paper
 * a line-art glyph turns to mud, and this rail has to stay legible collapsed to
 * 78px where the mark is all there is.
 *
 * `↗` for escalations is the same arrow the decision bar spends on "can't
 * decide — escalate", so the door and the act that fills it carry one sign.
 * `◈` for the states gallery is the odd one out and deliberately so — it is a
 * reference shelf, not a place work happens.
 */
export const DOORS: readonly Door[] = [
  { path: "/queue", key: "q", label: "queue", group: "work", icon: "▤" },
  { path: "/overview", key: "o", label: "overview", group: "work", icon: "◫" },
  { path: "/ingest", key: "u", label: "upload", group: "this-order" },
  { path: "/questions", key: "n", label: "questions", group: "this-order" },
  { path: "/processing", key: "p", label: "processing", group: "this-order" },
  { path: "/completeness", key: "c", label: "completeness", group: "this-order" },
  { path: "/delivered", key: "d", label: "delivered", group: "this-order" },
  {
    path: "/escalations",
    key: "e",
    label: "escalation inbox",
    group: "work",
    icon: "↗",
  },
  { path: "/rulebook", key: "b", label: "rulebook", group: "admin", icon: "§" },
  {
    path: "/products",
    key: "t",
    label: "products & sign-off",
    group: "admin",
    icon: "✎",
  },
  { path: "/clients", key: "l", label: "clients", group: "admin", icon: "⌂" },
  { path: "/people", key: "m", label: "people", group: "admin", icon: "◉" },
  { path: "/audit", key: "a", label: "audit", group: "admin", icon: "≡" },
  { path: "/profile", key: "f", label: "profile", group: "account" },
  { path: "/gallery", key: "g", label: "states", group: "reference", icon: "◈" },
];
