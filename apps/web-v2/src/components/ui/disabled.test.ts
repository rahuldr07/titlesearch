import { expect, test } from "vitest";
import { disabledAttributes } from "./disabled";

/**
 * RULE 9 AT THE LEVEL THE TYPE CANNOT REACH.
 *
 * `disabledBecause` being optional makes the compiler enforce "you cannot
 * disable without a reason", but it cannot enforce what ABSENCE means. Getting
 * that backwards — treating `undefined` as disabled — would make every control
 * in the app inert by default, which is a failure so loud it would be found in
 * a second. Treating an EMPTY STRING as disabled is the quiet one: a caller
 * writing `disabledBecause={blocker?.message ?? ""}` would produce a dead
 * control with an empty tooltip and no visible explanation, which is precisely
 * the rule 9 violation the whole design exists to prevent.
 *
 * Node env, no DOM: this is the pure half of the contract. The half that needs
 * a document (does an open Select actually mark its subtree for
 * `shared/chords.ts`?) is asserted in the Storybook play functions, which run
 * in a real browser.
 */

test("absence means live, in all three spellings", () => {
  expect(disabledAttributes(undefined).isDisabled).toBe(false);
  expect(disabledAttributes(null).isDisabled).toBe(false);
  // The quiet one. An empty reason is not a reason, so it does not disable.
  expect(disabledAttributes("").isDisabled).toBe(false);
});

test("a live control acquires no stray native tooltip", () => {
  const live = disabledAttributes(undefined);
  expect(live.title).toBeUndefined();
  expect(live["data-disabled-reason"]).toBeUndefined();
});

test("a reason disables, and is carried in the DOM as well as on hover", () => {
  const reason = "Blocked: T1 second read not countersigned.";
  const blocked = disabledAttributes(reason);

  expect(blocked.isDisabled).toBe(true);
  expect(blocked.title).toBe(reason);
  // `title` alone is unreachable on touch and by most screen readers, and
  // `e2e/invariants` asserts against the attribute rather than the tooltip.
  expect(blocked["data-disabled-reason"]).toBe(reason);
});

test("the reason is passed through verbatim", () => {
  // shared/notify.ts: a refused mutation surfaces the SERVER's message
  // unedited. The same holds for a refusal rendered as control state — no
  // prefix, no trailing period, no sentence-casing.
  const server = "belongs to QC — with R. Menon";
  expect(disabledAttributes(server).title).toBe(server);
});
