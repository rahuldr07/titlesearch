import type { Meta, StoryObj } from "@storybook/react-vite";
import { Drawer, DrawerTrigger, DrawerPanel, DrawerClose } from "./Drawer";
import { Button } from "./Button";
import { TextField } from "./TextField";
import { Eyebrow } from "./Eyebrow";

const meta = {
  title: "Primitives/Drawer",
  component: Drawer,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 460px on the right, over a `--color-scrim` backdrop. Base UI's Drawer is
 * first-class, so focus trapping, scroll locking, swipe-dismiss and nested
 * drawers come with it — rebuilding those on Dialog is how you end up with a
 * drawer that traps focus wrongly on exactly one screen.
 *
 * `title` is required by the component's own types: a dialog with no accessible
 * name is unnavigable by screen reader.
 */
export const EditLine: Story = {
  args: { children: null },
  render: () => (
    <Drawer>
      <DrawerTrigger render={<Button fill="outlined" tone="neutral">Edit line</Button>} />
      <DrawerPanel
        title="Edit sign-off line"
        description="Changes create a new config version. Orders already accepted keep the version they were frozen against."
      >
        <div className="flex flex-col gap-8">
          <label className="flex flex-col gap-3">
            <Eyebrow variant="field">Line text</Eyebrow>
            <TextField defaultValue="Are all recorded instruments in the chain present?" />
          </label>
          <label className="flex flex-col gap-3">
            <Eyebrow variant="field">Why it exists</Eyebrow>
            <TextField defaultValue="Catches a gap before the machine reads the package." />
          </label>
          <div className="flex gap-4">
            <DrawerClose render={<Button size="lg" block>Save line</Button>} />
            <DrawerClose
              render={<Button size="lg" fill="outlined" tone="neutral" block>Cancel</Button>}
            />
          </div>
        </div>
      </DrawerPanel>
    </Drawer>
  ),
};

export const Open: Story = {
  args: { children: null },
  render: () => (
    <Drawer defaultOpen>
      <DrawerPanel title="Edit client" description="Overrides are stored as deltas, never as a copy of the baseline.">
        <p className="text-base text-ink-secondary">
          A line with no traceable source is a config defect — the same discipline
          as field provenance.
        </p>
      </DrawerPanel>
    </Drawer>
  ),
};
