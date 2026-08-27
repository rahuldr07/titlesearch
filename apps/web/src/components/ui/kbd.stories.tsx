import type { Meta, StoryObj } from "@storybook/react-vite";
import { Kbd } from "./kbd";
import { onPanel } from "./kitGround";

/**
 * The design's actual chord vocabulary, rendered as written — `Esc` does not
 * become `ESC`, and that is the one behaviour worth a story of its own.
 */
const meta = {
  title: "ui/Kbd",
  decorators: [onPanel],
  component: Kbd,
  args: { children: "C" },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A single-letter chord. `min-w-10` keeps it from collapsing to a sliver. */
export const SingleKey: Story = {};

/** A modified chord — wider than the minimum, same cap. */
export const Modified: Story = { args: { children: "⌘K" } };

/** A pair, as the design writes navigation. */
export const Pair: Story = { args: { children: "J/K" } };

/** A named key. Case is passed through, not transformed. */
export const NamedKey: Story = { args: { children: "Esc" } };

/** The whole vocabulary the design uses. */
export const TheVocabulary: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      {["C", "E", "Q", "J/K", "Z", "⌘K", "?", "/", "Esc"].map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </div>
  ),
};

/**
 * MUTED — the button recipe's inline hint: "Confirm C" at .5–.6 opacity. No
 * box, because a bordered chip inside a control is a second object where the
 * design wants a hint.
 */
export const MutedInsideAButton: Story = {
  args: { children: "C", muted: true },
  render: (args) => (
    <button
      type="button"
      className="tp-state tp-press tp-target tp-ring inline-flex cursor-pointer items-center gap-4 rounded-lg bg-action px-8 font-sans text-meta leading-close font-semibold text-ink-on-action"
    >
      Confirm <Kbd {...args} />
    </button>
  ),
};

/** The two shapes side by side — a chip in prose, a hint in a control. */
export const ChipVersusHint: Story = {
  render: () => (
    <div className="flex flex-col gap-8 font-sans text-meta leading-close text-ink-secondary">
      <p className="flex items-center gap-3">
        Press <Kbd>⌘K</Kbd> to open the command bar.
      </p>
      <button
        type="button"
        className="tp-state tp-press tp-target tp-ring inline-flex w-fit cursor-pointer items-center gap-4 rounded-lg border border-control-border bg-surface-panel px-8 font-medium text-ink-secondary"
      >
        Escalate <Kbd muted>E</Kbd>
      </button>
    </div>
  ),
};
