import { onPanel } from "../panelGround";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { StageDots, type Stage } from "./StageDots";

/** The six-row sequential timeline of design §Screens 6. Statuses are the server's. */
const STAGES: readonly Stage[] = [
  { id: "quarantine", label: "Quarantine gateway", status: "done", note: "3 checks" },
  { id: "split", label: "Instrument split", status: "done", note: "41 instruments" },
  { id: "ocr", label: "Text layer recovery", status: "done", note: "412 pages" },
  { id: "extract", label: "Dual-engine extraction", status: "running", note: "268 of 412" },
  { id: "merge", label: "Merge and route", status: "waiting", note: null },
  { id: "review", label: "Examination", status: "waiting", note: null },
];

const meta = {
  title: "entities/StageDots",
  /* The ground these components actually stand on — see `panelGround.tsx`. */
  decorators: [onPanel],
  component: StageDots,
} satisfies Meta<typeof StageDots>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MidRun: Story = { args: { stages: STAGES } };

export const NotStarted: Story = {
  args: { stages: STAGES.map((s) => ({ ...s, status: "waiting", note: null })) },
};

/**
 * A BLOCKED STAGE, WHICH IS NOT A FAILED ONE. It cannot start; something else
 * has to move first. The note carries what, since only the server knows.
 */
export const Blocked: Story = {
  args: {
    stages: [
      ...STAGES.slice(0, 3),
      {
        id: "extract",
        label: "Dual-engine extraction",
        status: "blocked",
        note: "rulebook not seeded",
      },
      ...STAGES.slice(4),
    ],
  },
};
