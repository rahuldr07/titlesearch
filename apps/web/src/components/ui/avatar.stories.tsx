import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Avatar, AvatarLabel } from "./avatar";
import { onPanel } from "./kitGround";

/**
 * INITIALS ONLY, AND ONE STORY THAT PROVES IT: no `<img>` is rendered under any
 * arrangement, so no screen can acquire a network request per row.
 */
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
 * ON THE DARK CHROME. `tokens.css`: on `--color-rail-surface`,
 * `--color-ink-primary` measures 1.03:1 — the same luminance, invisible rather
 * than faint. This is the one register where the app palette is not merely off.
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
 * A LIST OF EXAMINERS IS A LIST. The registry's `AvatarGroup` overlapped
 * circles at `-space-x-2` and followed them with an `AvatarGroupCount` reading
 * "+3" — a number the browser derived, which rule 11 forbids. Three names read
 * as three people; three overlapping discs read as decoration.
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

/**
 * THE REFUSAL, AS AN ASSERTION. No `<img>`, anywhere, ever. If an
 * `AvatarImage` is ever reintroduced this fails before it reaches a screen.
 */
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

/**
 * THE NAME IS THE ACCESSIBLE NAME, and the initials are decoration for it. A
 * reader hears "R. Menon", not "R M".
 */
export const AnnouncesTheName: Story = {
  play: ({ canvasElement }) => {
    const node = canvasElement.querySelector('[data-slot="avatar"]');
    expect(node?.getAttribute("aria-label")).toBe("R. Menon");
    expect(node?.getAttribute("role")).toBe("img");
  },
};
