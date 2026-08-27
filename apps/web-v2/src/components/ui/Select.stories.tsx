import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Select } from "./Select";
import { Option } from "./Option";

/**
 * The story worth having here is not visual. Open the listbox and confirm the
 * popover carries `data-chord-scope="own"` — that attribute is what stands the
 * global single-key vocabulary down, and `shared/chords.ts` records the bug it
 * prevents (`q` escalating a field AND jumping a menu to "Quarantine").
 */
const meta = {
  title: "ui/Select",
  component: Select,
  args: {
    label: "Product",
    children: (
      <>
        <Option id="full">Full search</Option>
        <Option id="current">Current owner</Option>
        <Option id="two">Two owner</Option>
      </>
    ),
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/**
 * THE CHORD CONTRACT, ASSERTED IN A REAL BROWSER.
 *
 * Not a visual story. `shared/chords.ts` stands the global single-key
 * vocabulary down inside `[data-chord-scope='own']`, and this checks that the
 * attribute is actually in the document once the listbox is up — the other half
 * of a handshake whose handler side is tested by
 * `e2e/invariants/chord-suppression.spec.ts`.
 *
 * Without it, `q` inside an open Select both typeaheads to "Quarantine" AND
 * fires the global escalate chord on the field behind it.
 */
export const OpenMarksItsChordScope: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button"));
    await expect(document.querySelector("[data-chord-scope='own']")).not.toBe(null);
    // The listbox is a <div role="listbox">, which the prototype's tagName
    // guard is structurally incapable of seeing. This is why the mark exists.
    await expect(document.querySelector("[role='listbox']")).not.toBe(null);
  },
};

export const Selected: Story = { args: { defaultSelectedKey: "full" } };

export const WithDescription: Story = {
  args: { description: "Determines which rulebook layers apply." },
};

export const Invalid: Story = {
  args: { errorMessage: "Select a product before signing intake." },
};

export const BlockedWithReason: Story = {
  args: { disabledBecause: "Locked after intake is signed." },
};
