import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Tooltip, TooltipTrigger } from "./Tooltip";
import { Button } from "./Button";

/**
 * A tooltip only ever repeats or elaborates. The fact itself lives inline —
 * a disabled control states its reason in the DOM, not only on hover.
 */
const meta = { title: "ui/Tooltip", component: Tooltip } satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: "Jumps the evidence pane to the cited line." },
  render: (args) => (
    <TooltipTrigger>
      <Button icon size="sm" aria-label="Zoom to citation">
        Z
      </Button>
      <Tooltip {...args} />
    </TooltipTrigger>
  ),
};

export const Long: Story = {
  args: {
    children:
      "The second read must come from a different user than the ruling examiner. The server enforces this with a 409.",
  },
  render: (args) => (
    <TooltipTrigger>
      <Button>Countersign</Button>
      <Tooltip {...args} />
    </TooltipTrigger>
  ),
};

/**
 * THE ONE OVERLAY THAT DELIBERATELY DOES NOT MARK ITSELF, and the reason is the
 * inverse of every other case in the kit: a tooltip never takes focus and owns
 * no keys.
 *
 * Marking it would suspend the entire single-key vocabulary for as long as a
 * pointer rested on a toolbar button. A chord that dies on hover is
 * indistinguishable from a chord that is broken, which `shared/chords.ts` names
 * as a failure this project has already shipped once.
 */
export const DoesNotStandChordsDown: Story = {
  args: { children: "Requires a different user than the ruling examiner." },
  render: (args) => (
    <TooltipTrigger>
      <Button>Countersign</Button>
      <Tooltip {...args} />
    </TooltipTrigger>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /*
     * Opened by KEYBOARD FOCUS rather than by hover, and that is the better
     * assertion anyway: a tooltip that only appears on hover is unavailable to
     * the keyboard-first reader this app is built for. `userEvent.hover`
     * dispatches synthetic mouse events that react-aria's pointer-based hover
     * tracking deliberately ignores, so the hover spelling of this test failed
     * for a reason that had nothing to do with the contract being checked.
     */
    await userEvent.tab();
    await expect(await canvas.findByRole("button")).toHaveFocus();
    await expect(await within(document.body).findByRole("tooltip")).toBeInTheDocument();
    await expect(document.querySelector("[data-chord-scope='own']")).toBe(null);
  },
};
