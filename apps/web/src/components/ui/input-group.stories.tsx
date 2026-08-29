import type { Meta, StoryObj } from "@storybook/react-vite";
import { PanelGround } from "./panel-ground";
import { TextField } from "react-aria-components";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
} from "./input-group";
import { Label } from "./label";

/**
 * The wrapper owns the box and the control gives its own up, so focus and
 * invalid are drawn ONCE, on the wrapper. Tab into any of these: the ring is
 * the same 2px outline every other control in the kit uses.
 */
const meta = {
  title: "ui/InputGroup",
  component: InputGroup,
  decorators: [
    (Story) => (
      <PanelGround>
        <Story />
      </PanelGround>
    ),
  ],
} satisfies Meta<typeof InputGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A prefix glyph. Rule 7: no icon soup — the vocabulary is ✓ ◆ • T1. */
export const WithPrefix: Story = {
  render: () => (
    <InputGroup className="w-140">
      <InputGroupAddon>
        <InputGroupText>◆</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput aria-label="Search orders" placeholder="Search orders" />
    </InputGroup>
  ),
};

/** A suffix unit. Mono, because a unit sits against a data value (rule 3). */
export const WithSuffix: Story = {
  render: () => (
    <InputGroup defaultValue="184,500.00" className="w-90">
      <InputGroupInput aria-label="Consideration" data />
      <InputGroupAddon align="inline-end">
        <InputGroupText className="font-mono">USD</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  ),
};

/** A button inside the box: ghost, and one radius step in (rule 5). */
export const WithButton: Story = {
  render: () => (
    <InputGroup className="w-140">
      <InputGroupInput aria-label="Filter queue" placeholder="Filter queue" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton>Clear</InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
};

/** A blocked inner button still states its reason. There is no other way. */
export const ButtonBlockedWithReason: Story = {
  render: () => (
    <InputGroup className="w-140">
      <InputGroupInput aria-label="Filter queue" placeholder="Filter queue" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton disabledBecause="Blocked: the queue is not cherry-pickable.">
          Pin
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
};

/** The whole group recedes when its control is refused, and says why. */
export const BlockedWithReason: Story = {
  render: () => (
    <TextField isDisabled className="flex w-140 flex-col gap-3">
      <Label>Instrument number</Label>
      <InputGroup defaultValue="2019-0043117">
        <InputGroupAddon>
          <InputGroupText>•</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          data
          disabledBecause="Read from the clerk stamp — not editable."
        />
      </InputGroup>
    </TextField>
  ),
};

/** Invalid is drawn on the wrapper, so the border does not double up. */
export const Invalid: Story = {
  render: () => (
    <InputGroup defaultValue="2019-43117" className="w-140">
      <InputGroupInput
        aria-label="Instrument number"
        data
        aria-invalid
      />
      <InputGroupAddon align="inline-end">
        <InputGroupText className="text-state-halt">✕</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  ),
};

/** Block-aligned chrome stacks, so the fixed height is released. */
export const BlockAligned: Story = {
  render: () => (
    <InputGroup className="w-140">
      <InputGroupAddon align="block-start">
        <InputGroupText>Escalation note</InputGroupText>
      </InputGroupAddon>
      <InputGroupTextarea
        aria-label="Escalation note"
        placeholder="What you could not resolve."
      />
    </InputGroup>
  ),
};
