import type { Meta, StoryObj } from "@storybook/react-vite";
import type { SourcePage } from "@titlepipe/contract";
import { expect, fn, userEvent, within } from "storybook/test";
import { PageSpine } from "./PageSpine";
import { coverageCells } from "./pageCoverage";

const meta = {
  title: "Document/PageSpine",
  component: PageSpine,
  parameters: { layout: "padded" },
} satisfies Meta<typeof PageSpine>;

export default meta;
type Story = StoryObj<typeof meta>;

const page = (n: number, over: Partial<SourcePage> = {}): SourcePage => ({
  n,
  read_in_full: true,
  kind: "WARRANTY DEED",
  lines: [],
  degraded: false,
  ...over,
});

const SERVED: readonly SourcePage[] = [
  page(3),
  page(7, { degraded: true }),
  page(9, { read_in_full: false }),
  page(12),
  page(18),
  page(24),
  page(31),
];

/**
 * Seven pages served out of a 64-page package. The point of the spine is the
 * fifty-seven that are NOT here: they render as cells, not as absence.
 */
export const WholePackage: Story = {
  args: {
    cells: coverageCells(64, SERVED),
    currentPage: 7,
    onSelect: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByTestId("coverage-cell")).toHaveLength(64);
    // The un-read majority is a visible state, not a gap in a list.
    await expect(
      canvas.getByText(/not served — no reader typed this page \(57\)/),
    ).toBeInTheDocument();
  },
};

/** Every cell is keyboard-reachable, and the tier is in the accessible name. */
export const CellsAreButtons: Story = {
  // A spy in `args`, not a reassignment inside `play`: the component captured
  // the prop at render, so a later swap is never the function that runs.
  args: { cells: coverageCells(12, SERVED), currentPage: 7, onSelect: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const cells = await canvas.findAllByRole("button");
    await expect(cells).toHaveLength(12);
    await expect(
      canvas.getByRole("button", { name: "page 9, present, not read in full" }),
    ).toBeInTheDocument();

    const third = cells[2];
    if (third) await userEvent.click(third);
    expect(args.onSelect).toHaveBeenCalledWith(3);
  },
};

/**
 * Without `onSelect` the spine is a picture: same cells, same accessible names,
 * no button that moves nothing. `features/review/CoverageSpine` mounts it this
 * way, and it is the ONLY producer of `coverage-cell` on the review pane.
 */
export const PictureWithoutASelectHandler: Story = {
  args: { cells: coverageCells(12, SERVED) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByTestId("coverage-cell")).toHaveLength(12);
    await expect(canvas.queryAllByRole("button")).toHaveLength(0);
    await expect(
      canvas.getByRole("img", { name: "page 9, present, not read in full" }),
    ).toBeInTheDocument();
  },
};

/** "You are here" survives without colour — `aria-current` carries it too. */
export const CurrentPageIsMarked: Story = {
  args: { cells: coverageCells(12, SERVED), currentPage: 9, onSelect: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const current = canvas
      .getAllByTestId("coverage-cell")
      .filter((cell) => cell.getAttribute("aria-current") === "page");
    await expect(current).toHaveLength(1);
    await expect(current[0]).toHaveAttribute(
      "aria-label",
      "page 9, present, not read in full",
    );
  },
};

/**
 * Nothing served at all. Every cell is `unseen` and the legend says so — the
 * spine never renders an empty row that reads as "no package".
 */
export const NothingServed: Story = {
  args: { cells: coverageCells(9, []), currentPage: 1, onSelect: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByTestId("coverage-cell")).toHaveLength(9);
    await expect(
      canvas.getByText(/not served — no reader typed this page \(9\)/),
    ).toBeInTheDocument();
  },
};
