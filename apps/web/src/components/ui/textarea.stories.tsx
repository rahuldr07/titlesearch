import type { Meta, StoryObj } from "@storybook/react-vite";
import { PanelGround } from "./panel-ground";
import { TextField } from "react-aria-components";
import { Textarea } from "./textarea";
import { Label } from "./label";
import { FieldError } from "./field";

const meta = {
  title: "ui/Textarea",
  component: Textarea,
  decorators: [
    (Story) => (
      <PanelGround>
        <TextField className="flex w-140 flex-col gap-3">
          <Label>Examiner note</Label>
          <Story />
        </TextField>
      </PanelGround>
    ),
  ],
  args: { placeholder: "What you read, and where you read it." },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Same box as Input (field-chrome.ts), with a three-line floor. */
export const Rest: Story = {};

/** `field-sizing-content`: the box grows with the note, it does not scroll. */
export const GrowsWithContent: Story = {
  args: {
    defaultValue: [
      "Deed of trust at book 4412 page 118 names the same trustee as the",
      "release at 2019-0043117, but the release recites a different loan",
      "number. Escalating rather than ruling — no rulebook entry covers a",
      "trustee match with a loan-number mismatch on a substitution.",
    ].join(" "),
  },
};

/** A note is prose, but a pasted legal description is data. */
export const DataValue: Story = {
  args: {
    data: true,
    defaultValue:
      "LOT 14, BLOCK 2, ROLLING HILLS UNIT 3, MCR 118-42, MARICOPA COUNTY, ARIZONA",
  },
};

/** No boolean disabled exists, so the reason cannot be dropped. */
export const BlockedWithReason: Story = {
  args: {
    defaultValue: "Ruled: release is effective as to the 2016 deed of trust.",
    disabledBecause:
      "Blocked: the ruling is signed and the note is now part of the record.",
  },
};

export const Invalid: Story = {
  render: () => (
    <TextField isInvalid className="flex w-140 flex-col gap-3">
      <Label>Examiner note</Label>
      <Textarea defaultValue="looks fine" aria-invalid />
      <FieldError>
        An escalation needs the reading you could not resolve, not a verdict.
      </FieldError>
    </TextField>
  ),
};

/** Hover and focus are pseudo-states; tab into this one to see the ring. */
export const FocusAndHover: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <Textarea placeholder="Focus me" aria-label="Focus me" />
      <Textarea placeholder="Hover me" aria-label="Hover me" />
    </div>
  ),
};
