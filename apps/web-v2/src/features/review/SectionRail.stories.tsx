import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
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
  args: { fields: demoFields, selectedPath: "owner.names" },
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
 * Each section is a real `<a href="#section-x">`, so a BROWSER'S own fragment
 * navigation lands the reviewer on it and leaves `location.hash` a bookmarkable
 * pointer into the draft sheet. That real navigation is exercised end-to-end in
 * `review.spec.ts` (Playwright); a headless component-test session running an
 * actual top-level navigation mid-`play()` closes its own control connection,
 * so only the href is asserted here.
 *
 * `aria-current` MARKS THE SECTION HOLDING THE SELECTED FIELD, not the last one
 * clicked. This story used to click Judgments and assert the rail lit it up —
 * an assertion the rail could satisfy while pointing somewhere the reviewer had
 * long since left, because `j`/`k`, a `?field=` deep link and a click in the
 * sheet all move selection without touching the rail. Selection is URL-owned;
 * the rail reads it. Same announced-not-just-coloured convention `FieldRow`
 * uses for its own selected row.
 */
export const JumpsToSection: Story = {
  args: { fields: demoFields, selectedPath: "judgments.1.case_no" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", { name: /Judgments & Liens/ });
    await expect(link).toHaveAttribute("href", "#section-judgments");
    await expect(link).toHaveAttribute("aria-current", "true");
    // The section the reviewer is NOT in stays unmarked — the rail points at
    // one place because the reviewer is in one place.
    await expect(canvas.getByTestId("section-link-owner")).not.toHaveAttribute(
      "aria-current",
    );
  },
};

/**
 * A section with nothing open shows no badge — the rail is not a second tally.
 *
 * ASSERTED ON A BARE NUMERAL, NOT ON "ANY DIGIT". The old assertion read
 * `queryByText(/[0-9]/)` — which passed only for as long as the row carried
 * nothing else numeric, and would now match the section's own page ref `p12`.
 * A count and a citation are different facts; a test that cannot tell them
 * apart would go green on a rail that had dropped the cite and kept a wrong
 * badge. The badge is the only element here whose whole text IS a number.
 */
export const NoOpenFieldsShowsNoBadge: Story = {
  args: {
    fields: demoFields.filter((f) => f.path.startsWith("legal.")),
    selectedPath: "legal.lot",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const legal = canvas.getByRole("link", { name: /Legal Description/ });
    await expect(within(legal).queryByText(/^\d+$/)).not.toBeInTheDocument();
  },
};
