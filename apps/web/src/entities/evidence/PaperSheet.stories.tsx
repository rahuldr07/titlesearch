import { onPaper } from "../panelGround";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { PaperSheet, CitationBox } from "./PaperSheet";
import { ClerkStamp } from "./ClerkStamp";

/**
 * No panel decorator here, unlike every other entity story: paper is its own
 * surface family, and a sheet standing on a white panel is a sheet whose
 * whole point — this is evidence, not chrome — is erased by its background.
 */
const BODY =
  "THIS INDENTURE, made this 14th day of March, 1974, between JOHN P. WHITFIELD and ELEANOR M. WHITFIELD, husband and wife, of the County of San Diego, State of California, parties of the first part, and MARIA L. ESTRADA, a married woman as her sole and separate property, party of the second part, WITNESSETH: That the said parties of the first part, for and in consideration of the sum of TEN DOLLARS ($10.00), lawful money of the United States, do by these presents grant, bargain and sell unto the said party of the second part.";

const meta = {
  title: "entities/PaperSheet",
  component: PaperSheet,
  /* The paper surface, not the app canvas — see `panelGround.tsx`. */
  decorators: [onPaper],
} satisfies Meta<typeof PaperSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CleanScan: Story = { args: { children: BODY } };

/**
 * The stock the product actually gets — median text-layer coverage is well
 * under 25%, so this is the normal case and the clean one is the exception.
 */
export const DegradedScan: Story = { args: { children: BODY, degraded: true } };

export const WithClerkStamp: Story = {
  args: {
    children: BODY,
    stamp: <ClerkStamp caption="Recorded" detail="BK 4412 PG 88 · 1974-03-19" />,
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector("[data-clerk-stamp]")).not.toBeNull();
    expect(canvasElement.querySelector("[data-paper-sheet]")).not.toBeNull();
  },
};

/** The cited line, boxed: 1.5px accent rule plus the evidence fill. */
export const WithCitationBox: Story = {
  args: {
    stamp: <ClerkStamp caption="Recorded" detail="BK 4412 PG 88 · 1974-03-19" />,
    children: (
      <>
        THIS INDENTURE, made this 14th day of March, 1974, between JOHN P. WHITFIELD and
        ELEANOR M. WHITFIELD, husband and wife, party of the first part, and{" "}
        <CitationBox>MARIA L. ESTRADA, a married woman</CitationBox> as her sole and separate
        property, party of the second part, WITNESSETH.
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector("[data-citation-box]")).not.toBeNull();
  },
};
