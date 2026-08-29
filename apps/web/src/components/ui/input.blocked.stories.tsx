import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";

import { Input } from "./input";
import { Textarea } from "./textarea";
import { onPanel } from "./kitGround";

/**
 * REVIEW-03 B1, THE RENDERED-BEHAVIOUR HALF — the test two comments cited for
 * months before it existed (`disabled.test.ts` and `a11y.css` both pointed at
 * files that were never written, which is the exact "asserting a mechanism
 * nobody built" failure this kit keeps finding in itself).
 *
 * `disabled.test.ts` proves the PROP NAME: a native control gets `disabled`,
 * never `isDisabled`. This proves the prop lands: react-aria's `Input` and
 * `TextArea` are thin native wrappers, so `el.disabled` must be `true` on the
 * real element and typing into it must change nothing — the B1 bug was a
 * "blocked" Input that was fully editable, with every static gate green.
 *
 * The Textarea story also MEASURES the three-line floor: `min-h-36` is 72px at
 * this app's 2px base, and REVIEW-03 B3 found `tp-target`'s `min-block-size`
 * silently clobbering it to 24px until `a11y.css` grew its `:not([class*=
 * "min-h-"])` guard. `tp-target.test.ts` asserts the guard's SOURCE; this
 * asserts the computed result, which is the only thing a reader's note box
 * actually gets.
 */
const meta = {
  title: "ui/Input/blocked",
  decorators: [onPanel],
  component: Input,
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

const REASON = "Blocked: T1 second read not countersigned.";

export const BlockedInputRefusesTyping: Story = {
  render: () => (
    <Input aria-label="Corrected value" disabledBecause={REASON} />
  ),
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector<HTMLInputElement>("[data-slot='input']");
    if (input === null) throw new Error("no input rendered");

    // The NATIVE prop, on the NATIVE element — the whole point of B1.
    expect(input.disabled).toBe(true);
    expect(input.getAttribute("data-disabled-reason")).toBe(REASON);

    // A disabled control cannot take focus…
    input.focus();
    expect(document.activeElement).not.toBe(input);

    // …and typing at it changes nothing. This is the assertion that was
    // impossible to fake green in B1: the editable "blocked" input took text.
    await userEvent.type(input, "typed while blocked");
    expect(input.value).toBe("");
  },
};

export const BlockedTextareaRefusesTypingAndKeepsItsFloor: Story = {
  render: () => (
    <Textarea aria-label="Reason for correction" disabledBecause={REASON} />
  ),
  play: async ({ canvasElement }) => {
    const area = canvasElement.querySelector<HTMLTextAreaElement>(
      "[data-slot='textarea']",
    );
    if (area === null) throw new Error("no textarea rendered");

    expect(area.disabled).toBe(true);
    expect(area.getAttribute("data-disabled-reason")).toBe(REASON);

    area.focus();
    expect(document.activeElement).not.toBe(area);
    await userEvent.type(area, "typed while blocked");
    expect(area.value).toBe("");

    // THE MEASURED FLOOR: 72px = three lines of 13px — computed, so a future
    // utility winning the cascade against `min-h-36` fails here, not in prose.
    const minHeight = Number.parseFloat(getComputedStyle(area).minHeight);
    expect(minHeight).toBeGreaterThanOrEqual(72);
  },
};
