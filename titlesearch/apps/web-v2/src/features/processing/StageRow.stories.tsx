import type { Meta, StoryObj } from "@storybook/react-vite";
import type { PipelineStage, StageOwner } from "@titlepipe/contract";
import { expect, within } from "storybook/test";
import { DividedSection } from "../../shared/ui/ListRow";
import { StageRow } from "./StageRow";

/**
 * The gate behind `StageRow.tsx`'s owner-column note.
 *
 * That note claims the owner is a caption and not a badge. The export's MARKUP
 * disagrees — `TitlePipe.dc.html:508` fills the owner pill from
 * `s.badgeBg`/`s.badgeFg`, and `:2951-2954` assigns Automated a grey fill, LLM
 * agent a violet tint and You a solid violet — while its RENDER draws all three
 * as one plain uppercase label. The design spec (2026-07-30) rules that where
 * the two disagree the render governs, so the plain treatment is correct and
 * this story is what stops a later reader "restoring" the tones from the
 * markup: it asserts the three owners carry an IDENTICAL class list.
 *
 * The assertion is on the class list rather than on a screenshot because the
 * failure it guards is a per-owner branch — a `Record<StageOwner, string>` — and
 * a branch that exists is visible in the class list on the very first render,
 * before anyone has to eyeball a colour.
 */
const OWNERS: readonly StageOwner[] = ["Automated", "LLM agent", "You"];

/**
 * The same phase for all three, deliberately. Phase is the row's only state
 * signal; varying it would let a phase difference explain a class difference
 * and the assertion would stop meaning what it says.
 */
function stage(owner: StageOwner, id: string): PipelineStage {
  return {
    id,
    label: `Stage ${id}`,
    detail: "Deskew, de-speckle, OCR · 64 pages",
    owner,
    phase: "waiting",
  };
}

const meta = {
  title: "Processing/StageRow",
  component: StageRow,
  parameters: { layout: "padded" },
} satisfies Meta<typeof StageRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllThreeOwnersRenderIdentically: Story = {
  args: { stage: stage("Automated", "ingest") },
  render: () => (
    <DividedSection>
      {OWNERS.map((owner, index) => (
        <StageRow key={owner} stage={stage(owner, `s${index}`)} />
      ))}
    </DividedSection>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rendered = OWNERS.map((owner) => canvas.getByText(owner));
    const first = rendered[0];
    await expect(first).toBeInTheDocument();
    for (const owner of rendered) {
      // Identical class list, and therefore identical fill, border and ink.
      await expect(owner.className).toBe(first?.className);
    }
  },
};

/**
 * The owner caption says nothing about phase, so a halted row and a waiting row
 * carry the same owner treatment too. This is the second half of the same rule:
 * the phase belongs to the mark, the row tint and the title, and the owner
 * column stays out of it.
 */
export const OwnerIsUnchangedByPhase: Story = {
  args: { stage: stage("You", "qc") },
  render: () => (
    <DividedSection>
      <StageRow stage={{ ...stage("You", "qc-halted"), phase: "halted" }} />
      <StageRow stage={{ ...stage("You", "qc-waiting"), phase: "waiting" }} />
    </DividedSection>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [halted, waiting] = canvas.getAllByText("You");
    await expect(halted).toBeInTheDocument();
    await expect(halted?.className).toBe(waiting?.className);
  },
};
