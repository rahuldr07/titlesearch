import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Avatar, AvatarLabel } from "./avatar";
import { onPanel } from "./kitGround";

/** Initials only — one story asserts no <img> is ever rendered. */
const meta = {
  title: "ui/Avatar",
  decorators: [onPanel],
  component: Avatar,
  args: { name: "R. Menon", initials: "RM" },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The row size. The default. */
export const Medium: Story = { args: { size: "md" } };

/** Inline, beside a byline. */
export const Small: Story = { args: { size: "sm" } };

/** One initial — a mononym, or a record with no given name. */
export const SingleInitial: Story = { args: { name: "Delgado", initials: "D" } };

/**
 * On the dark chrome the app palette is unusable, not merely off:
 * --color-ink-primary on --color-rail-surface measures 1.03:1.
 */
export const OnRail: Story = {
  args: { onRail: true },
  parameters: { backgrounds: { value: "rail" } },
  decorators: [
    (Story) => (
      <div className="bg-rail-surface p-12">
        <Story />
      </div>
    ),
  ],
};

/** The named form, which is what the countersign panel actually writes. */
export const Labelled: Story = {
  render: () => <AvatarLabel name="R. Menon" initials="RM" detail="QC" />,
};

/** Without a role. Not everyone has one, so `detail` is optional. */
export const LabelledNoDetail: Story = {
  render: () => <AvatarLabel name="Ana R. Delgado" initials="AD" />,
};

/** The named form on the rail — the navigator's account row. */
export const LabelledOnRail: Story = {
  parameters: { backgrounds: { value: "rail" } },
  decorators: [
    (Story) => (
      <div className="bg-rail-surface p-12">
        <Story />
      </div>
    ),
  ],
  render: () => <AvatarLabel name="R. Menon" initials="RM" detail="QC" onRail />,
};

/**
 * A roster is a list of names, never overlapping discs with a browser-derived
 * "+3" count.
 */
export const ARosterIsAList: Story = {
  render: () => (
    <div className="flex flex-col gap-5">
      <AvatarLabel name="R. Menon" initials="RM" detail="QC" />
      <AvatarLabel name="Ana R. Delgado" initials="AD" detail="Examiner" />
      <AvatarLabel name="J. Whitfield" initials="JW" detail="Examiner" />
    </div>
  ),
};

/** No <img>, ever — fails if an AvatarImage is reintroduced. */
export const NoImageIsEverRendered: Story = {
  render: () => (
    <div className="flex flex-col gap-5">
      <Avatar name="R. Menon" initials="RM" />
      <AvatarLabel name="Ana R. Delgado" initials="AD" detail="Examiner" />
    </div>
  ),
  play: ({ canvasElement }) => {
    expect(canvasElement.querySelectorAll("img")).toHaveLength(0);
  },
};

/** The name is the accessible name; a reader hears "R. Menon", not "R M". */
export const AnnouncesTheName: Story = {
  play: ({ canvasElement }) => {
    const node = canvasElement.querySelector('[data-slot="avatar"]');
    expect(node?.getAttribute("aria-label")).toBe("R. Menon");
    expect(node?.getAttribute("role")).toBe("img");
  },
};
