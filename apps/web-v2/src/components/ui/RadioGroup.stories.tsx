import type { Meta, StoryObj } from "@storybook/react-vite";
import { RadioGroup, Radio } from "./RadioGroup";

const meta = {
  title: "ui/RadioGroup",
  component: RadioGroup,
  args: {
    label: "Reissue reason",
    children: (
      <>
        <Radio value="clerical">Clerical correction</Radio>
        <Radio value="scope">Scope change</Radio>
        <Radio value="defect">Defect found after release</Radio>
      </>
    ),
  },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = { args: { defaultValue: "clerical" } };

/** A reason needs a sentence under it; putting it in the label would make the
    accessible name a paragraph. */
export const WithDescriptions: Story = {
  args: {
    children: (
      <>
        <Radio value="clerical" description="Typo or transcription error. No re-examination.">
          Clerical correction
        </Radio>
        <Radio value="defect" description="Re-opens the examination. One way.">
          Defect found after release
        </Radio>
      </>
    ),
  },
};

export const BlockedWithReason: Story = {
  args: { disabledBecause: "Blocked: reissue closes after v2." },
};
