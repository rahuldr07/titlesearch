import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";

import { Input } from "./input";
import { Textarea } from "./textarea";
import { onPanel } from "./kitGround";

/**
 * The rendered-behaviour half of disabled.test.ts: react-aria's Input and
 * TextArea are thin native wrappers, so `el.disabled` must be true on the
 * real element and typing into it must change nothing. The Textarea story
 * also measures the three-line floor (min-h-36 is 72px at the 2px base) as a
 * computed value — tp-target.test.ts asserts the guard's source, this
 * asserts the result.
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

    // The native prop, on the native element.
    expect(input.disabled).toBe(true);
    expect(input.getAttribute("data-disabled-reason")).toBe(REASON);

    // A disabled control cannot take focus…
    input.focus();
    expect(document.activeElement).not.toBe(input);

    // …and typing at it changes nothing.
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

    // The measured floor: 72px = three lines of 13px — computed, so a future
    // utility winning the cascade against `min-h-36` fails here, not in prose.
    const minHeight = Number.parseFloat(getComputedStyle(area).minHeight);
    expect(minHeight).toBeGreaterThanOrEqual(72);
  },
};
