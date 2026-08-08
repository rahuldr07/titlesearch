import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { demoPages } from "@titlepipe/mocks";
import { CoverageSpine } from "./CoverageSpine";

const meta = {
  title: "Review/CoverageSpine",
  component: CoverageSpine,
  parameters: { layout: "padded" },
} satisfies Meta<typeof CoverageSpine>;

export default meta;
type Story = StoryObj<typeof meta>;

// `demoPages` is keyed generically (any order id may be looked up at runtime
// elsewhere), so `noUncheckedIndexedAccess` types this access as possibly
// `undefined` even for a literal key. Failing loudly here — rather than a
// silent `?? []` fallback — keeps the assertion below pinned to the REAL
// fixture instead of quietly asserting against zero.
const fixture = demoPages.ord_demo_1;
if (fixture === undefined)
  throw new Error("ord_demo_1 fixture missing from @titlepipe/mocks");

/** The single source of truth for the assertion below — same fixture the app serves. */
const coverage = {
  order_id: "ord_demo_1",
  total_pages: fixture.total,
  pages: fixture.pages,
};

/**
 * TASK 6's failing-test-turned-story. This repo runs component assertions as
 * Storybook `play` functions through the "storybook" Vitest project (see
 * vitest.config.ts) rather than standalone RTL `.test.tsx` files — the
 * "gates" project only collects `src/**\/*.test.ts` in a DOM-less node
 * environment, so a bare `render()`/`screen` test would never execute.
 *
 * `demoPages.ord_demo_1` carries 64 total pages and only a handful of served
 * entries (a mix of read-clean, read-degraded, and present-but-not-read-in-
 * full). The spine must still render exactly 64 cells — one per PACKAGE page,
 * never `pages.length` — and the summary must cite the total the server sent.
 */
export const AllSixtyFourPages: Story = {
  args: { coverage },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(coverage.total_pages).toBe(64); // pins the fixture itself
    await expect(canvas.getAllByTestId("coverage-cell")).toHaveLength(
      coverage.total_pages,
    );
    await expect(
      canvas.getByText(new RegExp(`Coverage · all ${coverage.total_pages} pages`)),
    ).toBeInTheDocument();
  },
};

/** Nothing served at all — the spine still draws the full run as `unseen`. */
export const NothingServedYet: Story = {
  args: { coverage: { order_id: "ord_empty", total_pages: 12, pages: [] } },
};
