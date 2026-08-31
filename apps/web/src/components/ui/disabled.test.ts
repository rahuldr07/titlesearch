import { expect, test } from "vitest";
import { disabledAttributes, disabledNativeAttributes } from "./disabled";

/**
 * react-aria's Input is a thin <input> wrapper that reads `disabled`, not
 * `isDisabled` — handed the composite spelling, a control renders its reason
 * faithfully while staying fully editable. These assert the prop name,
 * because the prop name was the bug; the rendered-behaviour half lives in
 * input.blocked.stories.tsx.
 */
test("a composite gets isDisabled and never the native prop", () => {
  const a = disabledAttributes("Blocked: T1 second read not countersigned.");
  expect(a.isDisabled).toBe(true);
  expect(a).not.toHaveProperty("disabled");
});

test("a native element gets disabled and never isDisabled", () => {
  const a = disabledNativeAttributes("Blocked: T1 second read not countersigned.");
  expect(a.disabled).toBe(true);
  expect(a).not.toHaveProperty("isDisabled");
});

test("both carry the reason verbatim, on title and on the data attribute", () => {
  const reason = "Blocked: county records outstanding";
  for (const a of [disabledAttributes(reason), disabledNativeAttributes(reason)]) {
    expect(a.title).toBe(reason);
    expect(a["data-disabled-reason"]).toBe(reason);
  }
});

test("no reason means live, and no stray tooltip", () => {
  for (const a of [disabledAttributes(undefined), disabledNativeAttributes(null), disabledAttributes("")]) {
    expect(a.title).toBeUndefined();
    expect(a["data-disabled-reason"]).toBeUndefined();
  }
  expect(disabledAttributes(undefined).isDisabled).toBe(false);
  expect(disabledNativeAttributes(undefined).disabled).toBe(false);
});
