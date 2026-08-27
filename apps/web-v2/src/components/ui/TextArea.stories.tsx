import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextArea } from "./TextArea";

const meta = {
  title: "ui/TextArea",
  component: TextArea,
  args: { label: "Escalation note" },
} satisfies Meta<typeof TextArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: { description: "Seen by the QC examiner who picks this up." },
};

/** Fixed height, internal scroll: the frame is one viewport tall and never scrolls. */
export const Tall: Story = { args: { rows: 10 } };

export const Invalid: Story = {
  args: { errorMessage: "An escalation requires a note." },
};

export const BlockedWithReason: Story = {
  args: { disabledBecause: "Belongs to QC — with R. Menon." },
};
