import type { Meta, StoryObj } from "@storybook/react-vite";
import { Kbd } from "./Kbd";

/** Rule 3 names kbd as one of the five things mono is for. */
const meta = { title: "ui/Kbd", component: Kbd, args: { children: "C" } } satisfies Meta<
  typeof Kbd
>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleKey: Story = {};

/** Case is passed through, so `Esc` never becomes `ESC`. */
export const NamedKey: Story = { args: { children: "Esc" } };

export const Chord: Story = { args: { children: "⌘K" } };

export const Vocabulary: Story = {
  render: () => (
    <div className="flex gap-4">
      <Kbd>C</Kbd>
      <Kbd>E</Kbd>
      <Kbd>Q</Kbd>
      <Kbd>J</Kbd>
      <Kbd>K</Kbd>
      <Kbd>Z</Kbd>
      <Kbd>?</Kbd>
    </div>
  ),
};
