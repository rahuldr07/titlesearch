import type { Meta, StoryObj } from "@storybook/react-vite";
import { PanelGround } from "./panel-ground";
import { TextField } from "react-aria-components";
import { Input } from "./input";
import { Label } from "./label";
import { FieldDescription, FieldError } from "./field";

/**
 * Every story renders the input INSIDE a `TextField` with a visible `Label`,
 * because a placeholder is not a label (WCAG 3.3.2) and a gallery that shows
 * the bare box is a gallery teaching the wrong assembly.
 */
const meta = {
  title: "ui/Input",
  component: Input,
  decorators: [
    (Story) => (
      <PanelGround>
        <TextField className="flex w-90 flex-col gap-3">
          <Label>Instrument number</Label>
          <Story />
        </TextField>
      </PanelGround>
    ),
  ],
  args: { placeholder: "e.g. 2019-0043117" },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 36px, radius 10, control fill on control border, 13px (RECIPES §Inputs). */
export const Rest: Story = {};

export const WithValue: Story = {
  render: () => (
    <TextField defaultValue="Warranty deed, book 4412">
      <Input />
    </TextField>
  ),
};

/** Rule 3: mono is for DATA — refs, money, citations, hashes, timestamps. */
export const DataValue: Story = {
  render: () => (
    <TextField defaultValue="2019-0043117">
      <Input data />
    </TextField>
  ),
};

/** Rule 9: there is no way to disable this without saying why. */
export const BlockedWithReason: Story = {
  render: () => (
    <TextField defaultValue="2019-0043117">
      <Input disabledBecause="Read from the clerk stamp — not editable." />
    </TextField>
  ),
};

/** Halt border, halt message. The label stays grey; the screen is not broken. */
export const Invalid: Story = {
  render: () => (
    <TextField defaultValue="2019-43117" isInvalid className="flex w-90 flex-col gap-3">
      <Label>Instrument number</Label>
      <Input data aria-invalid />
      <FieldError>Not found in the county package for Maricopa.</FieldError>
    </TextField>
  ),
};

/** Standing help, wired as `aria-describedby` rather than as a tooltip. */
export const Described: Story = {
  render: () => (
    <TextField className="flex w-90 flex-col gap-3">
      <Label>Instrument number</Label>
      <Input placeholder="e.g. 2019-0043117" data />
      <FieldDescription>
        As printed on the recorder's stamp, including the year.
      </FieldDescription>
    </TextField>
  ),
};

/** Hover and focus are pseudo-states args cannot set; tab through this one. */
export const FocusAndHover: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <Input placeholder="Focus me" aria-label="Focus me" />
      <Input placeholder="Hover me" aria-label="Hover me" />
    </div>
  ),
};
