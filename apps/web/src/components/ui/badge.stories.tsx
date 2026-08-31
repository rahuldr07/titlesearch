import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Badge, StatusMark } from "./badge";
import { onPanel } from "./kitGround";

/**
 * Badge is the expensive shape (a moment of record); StatusMark is the free
 * one (every row). The last stories put them side by side.
 */
const meta = {
  title: "ui/Badge",
  decorators: [onPanel],
  component: Badge,
  args: { children: "Released" },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A moment of record: the order is released. */
export const Settled: Story = { args: { tone: "settled", children: "Released" } };

/** Quarantine clear — the other moment of record the rule names. */
export const Attend: Story = { args: { tone: "attend", children: "Quarantine clear" } };

/** A halt worth a capsule: the package was refused at intake. */
export const Halt: Story = { args: { tone: "halt", children: "Intake refused" } };

/** T1 — rule 6 names it explicitly, and rule 1 says this is the accent spend. */
export const Accent: Story = { args: { tone: "accent", children: "T1 countersigned" } };

/** Every tone at once. Never a real screen — a screen spends one of these. */
export const AllTones: Story = {
  args: { children: "Released" },
  render: () => (
    <div className="flex flex-wrap gap-6">
      <Badge tone="settled">Released</Badge>
      <Badge tone="attend">Quarantine clear</Badge>
      <Badge tone="halt">Intake refused</Badge>
      <Badge tone="accent">T1 countersigned</Badge>
    </div>
  ),
};

/**
 * The marks — the shape a table row is allowed: glyph plus weight, no fill.
 * The play pins the closed vocabulary: ✓ ◆ • T1 and nothing else.
 */
export const Marks: Story = {
  args: { children: "" },
  render: () => (
    <div className="flex flex-col gap-6">
      <StatusMark mark="settled" label="Settled" />
      <StatusMark mark="attend" label="Needs review" />
      <StatusMark mark="halt" label="Blocked" />
      <StatusMark mark="tier1" label="Second read required" />
    </div>
  ),
  play: ({ canvasElement }) => {
    const glyphs = [
      ...canvasElement.querySelectorAll('[data-slot="status-mark"] [aria-hidden]'),
    ].map((n) => n.textContent);
    expect(glyphs).toEqual(["✓", "◆", "•", "T1"]);
  },
};

/** A ✓ on a row you are not being asked to act on. Desaturated, not hidden. */
export const MarkResting: Story = {
  args: { children: "" },
  render: () => <StatusMark mark="settled" label="Settled" resting />,
};

/**
 * Rows carry marks; only the moment-of-record row carries a capsule. A
 * capsule on every row is the violation this story makes look wrong.
 */
export const RowBudget: Story = {
  args: { children: "" },
  render: () => (
    <table className="w-160 border-collapse font-sans text-meta leading-close">
      <tbody>
        {[
          { ref: "TX-2291-004", mark: "settled" as const, label: "Settled" },
          { ref: "TX-2291-005", mark: "attend" as const, label: "Needs review" },
          { ref: "TX-2291-006", mark: "halt" as const, label: "Blocked" },
        ].map((row) => (
          <tr key={row.ref} className="border-b border-line-subtle">
            <td className="py-6 font-mono text-ink-secondary">{row.ref}</td>
            <td className="py-6 text-right">
              <StatusMark mark={row.mark} label={row.label} />
            </td>
          </tr>
        ))}
        <tr>
          <td className="py-6 font-mono text-ink-secondary">TX-2291-007</td>
          <td className="py-6 text-right">
            <Badge tone="settled">Released</Badge>
          </td>
        </tr>
      </tbody>
    </table>
  ),
};
