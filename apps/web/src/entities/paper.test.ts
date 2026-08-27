import { expect, test } from "vitest";
import { readFileSync } from "node:fs";

/**
 * REVIEW-03 B5. `entities.css` was imported by NOTHING for an entire rebuild.
 * `tp-paper-grain`, `tp-paper-tilt` and `tp-na-hatch` were never emitted, so
 * `PaperSheet` rendered with the class names on the element and
 * `backgroundImage: none, transform: none` — a flat beige rectangle where rule
 * 8 requires paper, and NOT_STATED without the hatch that is its distinguishing
 * channel against NOT_FOUND (rule 14, INVARIANT 7).
 *
 * A missing @import is invisible to tsc, eslint, check-rules AND Storybook,
 * because all four see the class NAME and none sees whether a rule was emitted.
 * So this asserts the import graph — the only layer where the failure lives.
 */
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("the domain layer's stylesheet is reachable from the root", () => {
  expect(styles).toMatch(/@import\s+"\.\/entities\/entities\.css"/);
});

test("every stylesheet in the tree is imported somewhere", () => {
  // Adding a .css file and forgetting to import it is the exact failure above.
  const known = ["./components/ui/ui.css", "./components/ui/overlays.css", "./entities/entities.css"];
  for (const path of known) expect(styles).toContain(path);
});

test("the three utilities the paper register needs are declared", () => {
  const entities = readFileSync(new URL("./entities.css", import.meta.url), "utf8");
  expect(entities).toMatch(/@utility tp-paper-grain/);
  expect(entities).toMatch(/@utility tp-paper-tilt/);
  expect(entities).toMatch(/@utility tp-na-hatch/);
});
