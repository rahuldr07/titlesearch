import type { Meta, StoryObj } from "@storybook/react-vite";
import { Select, SelectTrigger, SelectPopup, SelectItem } from "./Select";
import { Eyebrow } from "./Eyebrow";

const meta = {
  title: "Primitives/Select",
  component: Select,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The trigger matches TextField's geometry exactly — same border, radius and
 * padding — because in the design a select sits in the same form rows as text
 * inputs, and any difference there reads as an accident rather than a choice.
 *
 * `aria-labelledby` points at the visible Eyebrow so sighted and non-sighted
 * users get the same words. The trigger is a `role="combobox"`; without this it
 * has no accessible name, which axe fails on the Storybook run.
 */
export const CiteARule: Story = {
  args: { children: null },
  render: () => (
    <div className="flex flex-col gap-3 max-w-160">
      <Eyebrow variant="field" id="lbl-cite">
        Cite an existing rule
      </Eyebrow>
      <Select>
        <SelectTrigger
          aria-labelledby="lbl-cite"
          placeholder="Choose the rule this ruling follows…"
        />
        <SelectPopup>
          <SelectItem value="r13">
            R13 — name + county match during ownership
          </SelectItem>
          <SelectItem value="r22">
            R22 — a lis pendens reports under its own type
          </SelectItem>
          <SelectItem value="r07">R07 — HOA liens report regardless of age</SelectItem>
        </SelectPopup>
      </Select>
    </div>
  ),
};

export const WithSelection: Story = {
  args: { children: null },
  render: () => (
    <div className="flex flex-col gap-3 max-w-160">
      <Eyebrow variant="field" id="lbl-sel">
        Cite an existing rule
      </Eyebrow>
      <Select defaultValue="r13">
        <SelectTrigger aria-labelledby="lbl-sel" />
        <SelectPopup>
          <SelectItem value="r13">
            R13 — name + county match during ownership
          </SelectItem>
          <SelectItem value="r22">
            R22 — a lis pendens reports under its own type
          </SelectItem>
          <SelectItem value="r07" disabled>
            R07 — PENDING, cannot be cited
          </SelectItem>
        </SelectPopup>
      </Select>
    </div>
  ),
};

export const Disabled: Story = {
  args: { children: null },
  render: () => (
    <div className="flex flex-col gap-3 max-w-160">
      <Eyebrow variant="field" id="lbl-frozen">
        Frozen on the order
      </Eyebrow>
      <Select disabled>
        <SelectTrigger aria-labelledby="lbl-frozen" placeholder="config v4 · frozen" />
        <SelectPopup>
          <SelectItem value="v4">config v4</SelectItem>
        </SelectPopup>
      </Select>
    </div>
  ),
};
