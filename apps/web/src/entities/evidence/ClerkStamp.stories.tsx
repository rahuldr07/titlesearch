import { onPaper } from "../panelGround";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ClerkStamp } from "./ClerkStamp";

/**
 * CSS art — no binary assets. Rotated −3.5°, ten times the sheet's own tilt:
 * a page is laid down crooked, a stamp is pressed by a hand.
 */
const meta = {
  title: "entities/ClerkStamp",
  component: ClerkStamp,
  /* The paper surface, not the app canvas — see `panelGround.tsx`. */
  decorators: [onPaper],
} satisfies Meta<typeof ClerkStamp>;

export default meta;
type Story = StoryObj<typeof meta>;

/** San Diego, which records by BOOK/PAGE and has no instrument number. */
export const BookAndPage: Story = {
  args: { caption: "Recorded", detail: "BK 4412 PG 88 · 1974-03-19" },
};

/** Houston, which records by INST# and has no book/page — the mirror case. */
export const InstrumentNumber: Story = {
  args: { caption: "Filed for record", detail: "INST# 2019-0448812" },
};
