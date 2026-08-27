import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Dialog, DialogTrigger } from "./Dialog";
import { Button } from "./Button";

/**
 * The story to actually open: the overlay carries `data-chord-scope="own"` from
 * the moment the scrim mounts, which is what stops `?` then `c` from confirming
 * a ruling out of the cheat sheet — the prototype bug `shared/chords.ts` and
 * `e2e/invariants/chord-suppression.spec.ts` both pin.
 */
const meta = { title: "ui/Dialog", component: Dialog } satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { title: "Audit history", children: null },
  render: (args) => (
    <DialogTrigger>
      <Button>Open audit history</Button>
      <Dialog {...args}>
        <p className="font-sans text-body leading-body text-ink-secondary">
          This order has no loaded dataset, so the workstation cannot open.
        </p>
      </Dialog>
    </DialogTrigger>
  ),
};

export const WithActions: Story = {
  args: { title: "Sign and execute release", children: null },
  render: (args) => (
    <DialogTrigger>
      <Button variant="primary">Sign & execute release</Button>
      <Dialog {...args}>
        <p className="font-sans text-body leading-body text-ink-secondary">
          The gate is re-checked transactionally at execution.
        </p>
        <div className="flex justify-end gap-6">
          <Button variant="quiet" slot="close">
            Cancel
          </Button>
          <Button variant="primary">Execute</Button>
        </div>
      </Dialog>
    </DialogTrigger>
  ),
};

/**
 * `? then c CONFIRMS A RULING from inside the cheat sheet` — the prototype bug
 * `shared/chords.ts` pins. An overlay that is up stands the vocabulary down,
 * and the mark sits on the ModalOverlay so it exists from the moment the scrim
 * mounts rather than from when focus lands inside.
 */
export const OpenMarksItsChordScope: Story = {
  args: { title: "Keyboard shortcuts", children: null },
  render: (args) => (
    <DialogTrigger>
      <Button>Show shortcuts</Button>
      <Dialog {...args}>
        <p className="font-sans text-body leading-body text-ink-secondary">C confirms.</p>
      </Dialog>
    </DialogTrigger>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button"));
    await expect(document.querySelector("[role='dialog']")).not.toBe(null);
    await expect(document.querySelector("[data-chord-scope='own']")).not.toBe(null);
  },
};

/** Not dismissable: the reader must answer rather than press Esc past it. */
export const NotDismissable: Story = {
  args: { title: "Reissue reason required", isDismissable: false, children: null },
  render: (args) => (
    <DialogTrigger>
      <Button>Reissue</Button>
      <Dialog {...args}>
        <p className="font-sans text-body leading-body text-ink-secondary">
          A reissue is one way and closes after v2.
        </p>
        <Button slot="close">Close</Button>
      </Dialog>
    </DialogTrigger>
  ),
};
