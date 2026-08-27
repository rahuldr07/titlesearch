import type { Meta, StoryObj } from "@storybook/react-vite";
import { PanelGround } from "./panel-ground";
import { TextField } from "react-aria-components";
import { Label } from "./label";
import { Input } from "./input";

/**
 * RECIPES §Inputs: "Labels: 11px w700 grey above." The stories exist mostly to
 * prove the label does NOT compete with the value it names — put a 13px value
 * under an 11px label and the hierarchy reads at a glance or it does not.
 */
const meta = {
  title: "ui/Label",
  component: Label,
  args: { children: "Instrument number" },
  decorators: [
    (Story) => (
      <PanelGround>
        <Story />
      </PanelGround>
    ),
  ],
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rest: Story = {};

/** Rule 4: sentence case. ALL-CAPS is legal only for rubrics and certificates. */
export const SentenceCase: Story = { args: { children: "Recorded date and time" } };

/** The assembly it is for: 11px grey above, 13px ink below. */
export const AboveItsControl: Story = {
  render: () => (
    <TextField defaultValue="2019-0043117" className="flex w-90 flex-col gap-3">
      <Label>Instrument number</Label>
      <Input data />
    </TextField>
  ),
};

/**
 * Disabled recedes to `--color-ink-disabled` rather than to `opacity-50`: at
 * 11px, half-transparent grey on white is under 3:1 and stops being a label.
 */
export const AlongsideBlockedControl: Story = {
  render: () => (
    <TextField defaultValue="2019-0043117" isDisabled className="flex w-90 flex-col gap-3">
      <Label>Instrument number</Label>
      <Input
        data
        disabledBecause="Read from the clerk stamp."
      />
    </TextField>
  ),
};

/**
 * An invalid field does NOT turn its label red. The control gets a halt border
 * and the message gets halt ink; tinting all three makes a wrong digit look
 * like a broken screen.
 */
export const AlongsideInvalidControl: Story = {
  render: () => (
    <TextField defaultValue="2019-43117" isInvalid className="flex w-90 flex-col gap-3">
      <Label>Instrument number</Label>
      <Input data aria-invalid />
    </TextField>
  ),
};

/**
 * `htmlFor` outside a field. The `LabelContext.Provider value={null}` wrapper
 * is what keeps it pointing where the caller said, rather than being captured
 * by an enclosing field's context.
 */
export const ExplicitHtmlFor: Story = {
  render: () => (
    <div className="flex w-90 flex-col gap-3">
      <Label htmlFor="parcel">Parcel identifier</Label>
      <Input id="parcel" data />
    </div>
  ),
};
