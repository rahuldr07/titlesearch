import { expect, test } from "vitest";
import { readFileSync } from "node:fs";

/**
 * A missing @import is invisible to tsc, eslint, check-rules and Storybook:
 * all four see the class name and none sees whether a rule was emitted. So
 * these assert the import graph — the only layer where the failure lives.
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
