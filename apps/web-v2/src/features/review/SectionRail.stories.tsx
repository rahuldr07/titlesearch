import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { demoFields } from "@titlepipe/mocks";
import { SectionRail } from "./SectionRail";

const meta = {
  title: "Review/SectionRail",
  component: SectionRail,
  parameters: { layout: "padded" },
} satisfies Meta<typeof SectionRail>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * TASK 7. `demoFields` carries the same six sections the delivered Word
 * document uses (owner, legal, deed, mortgages, judgments, assessment) and a
 * mix of states within each, so the rail's grouping and its per-section badge
 * can both be pinned against the one fixture the app itself serves.
 *
 * Judgments has two open fields (`judgments.1.plaintiff_attorney`,
 * `judgments.1.case_no`, both `needs_review`) against three settled ones — the
 * badge must read 2, not 5 and not 0.
 *
 * THE NAMES ARE THE DELIVERED DOCUMENT'S (2026-07-31): the rail took the
 * export's Title Case headings verbatim, so `Vesting & owner` is `Vesting` and
 * `Judgments & liens` is `Judgments & Liens`. The assertions moved with the
 * copy; they were pinning a paraphrase.
 */
export const AllSections: Story = {
  args: { fields: demoFields },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // By testid, not by name: `Vesting` is now a PREFIX of `Vesting Deed`, and
    // a name regex that matches both is an ambiguous query, not an assertion.
    const owner = canvas.getByTestId("section-link-owner");
    await expect(within(owner).getByText("Vesting")).toBeInTheDocument();
    const judgments = canvas.getByRole("link", { name: /Judgments & Liens/ });
    await expect(judgments).toBeInTheDocument();
    await expect(within(judgments).getByText("2")).toBeInTheDocument();
  },
};

/**
 * Clicking a section jumps the report — a real `<a href="#section-x">`, so a
 * BROWSER'S own fragment navigation lands the reviewer on it and leaves
 * `location.hash` a bookmarkable pointer into the draft sheet. That real
 * navigation is exercised end-to-end in `review.spec.ts` (Playwright); a
 * headless component-test session running an actual top-level navigation
 * mid-`play()` closes its own control connection, so the click here is
 * captured before the browser acts on it and only the REACT side — the
 * `aria-current` the rail sets, the same announced-not-just-coloured
 * convention `FieldRow` uses for its own selected row — is asserted.
 */
export const JumpsToSection: Story = {
  args: { fields: demoFields },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", { name: /Judgments & Liens/ });
    await expect(link).toHaveAttribute("href", "#section-judgments");
    await expect(link).not.toHaveAttribute("aria-current");
    link.addEventListener("click", (e) => e.preventDefault(), { once: true });
    await userEvent.click(link);
    await expect(link).toHaveAttribute("aria-current", "true");
  },
};

/** A section with nothing open shows no badge — the rail is not a second tally. */
export const NoOpenFieldsShowsNoBadge: Story = {
  args: {
    fields: demoFields.filter((f) => f.path.startsWith("legal.")),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const legal = canvas.getByRole("link", { name: /Legal Description/ });
    await expect(within(legal).queryByText(/[0-9]/)).not.toBeInTheDocument();
  },
};
