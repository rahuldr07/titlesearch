import { onPanel } from "../panelGround";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CitationRef } from "./CitationRef";

/**
 * The canonical mono case. There is no story rendering a citation in the
 * sans face because the component accepts no typography props — the rule is
 * the API, not a convention a story could violate.
 */
const meta = {
  title: "entities/CitationRef",
  /* The ground these components actually stand on — see `panelGround.tsx`. */
  decorators: [onPanel],
  component: CitationRef,
} satisfies Meta<typeof CitationRef>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithSnippet: Story = {
  args: {
    citation: { docId: "DOC-8841", page: 12, snippet: "MARIA L. ESTRADA, a married woman" },
  },
};

/**
 * No snippet, and that is not a typed absence: the doc and page still locate
 * the value, so nothing is drawn in its place.
 */
export const WithoutSnippet: Story = {
  args: { citation: { docId: "DOC-8841", page: 12, snippet: null } },
};

/** Click-to-source: a record becomes an affordance. */
export const Clickable: Story = {
  args: {
    citation: { docId: "DOC-8841", page: 12, snippet: "MARIA L. ESTRADA, a married woman" },
    onOpen: () => {},
  },
};
