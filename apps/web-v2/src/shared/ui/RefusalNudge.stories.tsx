import type { Meta, StoryObj } from "@storybook/react-vite";
import { useId, useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { RefusalNudge } from "./RefusalNudge";
import { Button } from "./Button";
import { Eyebrow } from "./Eyebrow";
import { TextArea } from "./TextField";

const LABEL = "Why is this correction right?";
const MESSAGE = "A correction needs both the value and its why.";

/**
 * A refused field, assembled the way a real editor assembles one. The stories
 * below ASSERT the aria link rather than photographing it: three of the eleven
 * sites that draw this refusal today omit the link, and they look identical on
 * screen to the eight that do not. A story that only rendered would have passed
 * on all eleven.
 */
function RefusedField({ hint = false }: { hint?: boolean }) {
  const [refused, setRefused] = useState(true);
  const controlId = useId();
  const hintId = useId();
  return (
    <div className="flex max-w-160 flex-col gap-3">
      <Eyebrow as="label" htmlFor={controlId}>
        {LABEL}
      </Eyebrow>
      <TextArea
        id={controlId}
        rows={2}
        tone={refused ? "halt" : "neutral"}
        emphasis={refused}
        {...(hint ? { "aria-describedby": hintId } : {})}
      />
      {hint ? (
        <p id={hintId} data-testid="hint" className="text-xs text-ink-muted">
          The why is what makes this a rule later.
        </p>
      ) : null}
      {refused ? <RefusalNudge controlId={controlId} message={MESSAGE} /> : null}
      <div>
        <Button size="sm" data-testid="write-the-why" onClick={() => setRefused(false)}>
          Write the why
        </Button>
      </div>
    </div>
  );
}

const meta = {
  title: "Primitives/RefusalNudge",
  component: RefusalNudge,
  parameters: { layout: "padded" },
  args: { message: MESSAGE, controlId: "unused-by-the-rendered-stories" },
} satisfies Meta<typeof RefusalNudge>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * §4.6 is a release blocker, so it has to reach a screen reader, not just an
 * eye. The assertion RESOLVES the id — `aria-describedby` naming an element
 * that does not exist announces nothing, and is indistinguishable from correct
 * markup in a snapshot.
 */
export const TheControlPointsAtTheRefusal: Story = {
  render: () => <RefusedField />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const control = canvas.getByLabelText(LABEL);
    const nudge = canvas.getByRole("alert");
    const ids = (control.getAttribute("aria-describedby") ?? "").split(" ");
    await expect(ids).toContain(nudge.id);
    await expect(canvasElement.ownerDocument.getElementById(nudge.id)).toBe(nudge);
    await expect(nudge).toHaveTextContent(MESSAGE);
  },
};

/**
 * Being refused must not make a field LESS described than it was. The link is
 * appended, so the hint the control already carried is still second in the
 * list — and still resolves.
 */
export const AnExistingHintSurvivesTheRefusal: Story = {
  render: () => <RefusedField hint />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const control = canvas.getByLabelText(LABEL);
    const hint = canvas.getByTestId("hint");
    const nudge = canvas.getByRole("alert");
    const ids = (control.getAttribute("aria-describedby") ?? "").split(" ");
    await expect(ids).toEqual([hint.id, nudge.id]);
    await expect(canvasElement.ownerDocument.getElementById(hint.id)).toBe(hint);
  },
};

/**
 * The other half of owning the wiring. A stale `aria-describedby` pointing at a
 * removed line is worse than none: the control still claims a description and
 * the reader is told nothing. Cleanup removes OUR id only — the hint stays.
 *
 * NOTE for the sweep: the control's own `aria-describedby` prop and this
 * component's write are two authors of one attribute. React only touches it
 * when the PROP changes, so a static hint id is safe; a call site that varies
 * that prop while the nudge is mounted would clobber the link.
 */
export const ClearingTheRefusalUnlinksIt: Story = {
  render: () => <RefusedField hint />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const control = canvas.getByLabelText(LABEL);
    const hintId = canvas.getByTestId("hint").id;
    const nudgeId = canvas.getByRole("alert").id;
    await userEvent.click(canvas.getByTestId("write-the-why"));
    await expect(canvas.queryByRole("alert")).toBeNull();
    const ids = (control.getAttribute("aria-describedby") ?? "").split(" ");
    await expect(ids).not.toContain(nudgeId);
    await expect(ids).toEqual([hintId]);
  },
};
