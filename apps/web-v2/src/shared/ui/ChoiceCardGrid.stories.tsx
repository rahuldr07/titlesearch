import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ChoiceCardGrid } from "./ChoiceCardGrid";
import { Eyebrow } from "./Eyebrow";

const meta = {
  title: "Primitives/ChoiceCardGrid",
  component: ChoiceCardGrid,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ChoiceCardGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

const CLIENTS = [
  { id: "cli_a", title: "Sample Client — Riverbend Title", sub: "RVB" },
  { id: "cli_b", title: "Sample Client — Hollowyn Lending", sub: "HLW" },
] as const;

const PRODUCTS = [
  { id: "p_cos", title: "COS", sub: "Current owner — vesting deed + open matters" },
  { id: "p_tos", title: "TOS", sub: "Current owner + one prior owner" },
  { id: "p_upd", title: "Update", sub: "New matter since a prior effective date" },
  { id: "p_y20", title: "20 Year", sub: "Full search · 20 years back" },
  { id: "p_y40", title: "40 Year", sub: "Full search · 40 years back" },
  { id: "p_y60", title: "60 Year", sub: "Full search · 60 years back" },
] as const;

/**
 * The `<fieldset>`/`<legend>` is the call site's job and is shown here because
 * without it the grid is a set of radios nobody has named — the question is
 * "which client", and a screen reader has to be told that too.
 */
export const TwoColumn: Story = {
  args: { name: "client", columns: 2, options: CLIENTS, value: null, onSelect: () => {} },
  render: function Render() {
    const [value, setValue] = useState<string | null>(null);
    return (
      <fieldset className="flex flex-col gap-4">
        <Eyebrow as="legend" variant="field">
          CLIENT &middot; REQUIRED &middot; RESOLVES THE EFFECTIVE SIGN-OFF
        </Eyebrow>
        <ChoiceCardGrid name="client" columns={2} options={CLIENTS} value={value} onSelect={setValue} />
      </fieldset>
    );
  },
};

/** Six cards, one already chosen — the design's drawn state for the product grid. */
export const ThreeColumnChosen: Story = {
  args: { name: "product", columns: 3, options: PRODUCTS, value: "p_y40", onSelect: () => {} },
  render: function Render() {
    const [value, setValue] = useState<string | null>("p_y40");
    return (
      <fieldset className="flex flex-col gap-4">
        <Eyebrow as="legend" variant="field">
          PRODUCT ORDERED &middot; SETS THE QUESTIONS AND THE SCOPE
        </Eyebrow>
        <ChoiceCardGrid name="product" columns={3} options={PRODUCTS} value={value} onSelect={setValue} />
      </fieldset>
    );
  },
};
