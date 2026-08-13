import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactElement } from "react";
import { expect, within } from "storybook/test";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"; // rules-allow: the hub Link needs router context, so the story mounts a one-route router rather than stubbing the behaviour ux.spec #7 exists to protect
import { ScreenHeading } from "./ScreenHeading";
import { Button } from "./Button";

/**
 * A bare root route at `/` — enough for the eyebrow's `to="/"` to resolve
 * without pulling in the eighteen real screens. Stubbing the Link instead
 * would leave `ux.spec` #7 untested in the one place it is drawn.
 */
function mount(node: ReactElement): ReactElement {
  const rootRoute = createRootRoute({ component: () => node });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return <RouterProvider router={router} />;
}

const meta = {
  title: "Primitives/ScreenHeading",
  component: ScreenHeading,
  parameters: { layout: "padded" },
  render: (args) => mount(<ScreenHeading {...args} />),
} satisfies Meta<typeof ScreenHeading>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The 22px h1 the design draws on most screens. The play test is the whole
 * point of the component: the eyebrow IS the anchor home, and it carries the
 * testid every `ux.spec` screen assertion looks for.
 */
export const Default: Story = {
  args: {
    eyebrow: "Admin · Rulebook",
    title: "Extraction rules",
    lede: "A rule is inert until an engineer or admin confirms it. Writing a rule and enabling it are separate acts. Nothing is ever deleted — rules retire.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = await canvas.findByTestId("screen-title");
    await expect(link.tagName).toBe("A");
    await expect(link).toHaveAttribute("href", "/");
    await expect(link).toHaveTextContent("Admin · Rulebook");
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Extraction rules",
    );
  },
};

/** Rulebook's "+ New rule" — pinned to the h1, not to the end of the lede. */
export const WithActions: Story = {
  args: {
    eyebrow: "Admin · Rulebook",
    title: "Extraction rules",
    lede: "A rule is inert until an engineer or admin confirms it. Nothing is ever deleted — rules retire.",
    actions: (
      <Button size="md" data-testid="new-rule">
        ＋ New rule
      </Button>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("new-rule")).toBeVisible();
    await expect(canvas.getByTestId("screen-title")).toBeVisible();
  },
};

/** The 26px h1 — upload is the clearest instance. */
export const Large: Story = {
  args: {
    eyebrow: "Step 1 — Upload",
    title: "New title-search package",
    size: "26",
    lede: "One county package per order. The pipeline reads what you hand it and refuses what it cannot.",
  },
};

/** No lede. The masthead still has to hold together as two lines. */
export const TitleOnly: Story = {
  args: { eyebrow: "Reference", title: "Every state this app can render" },
};

/**
 * Two paragraphs in the lede slot — Overview's thesis and the SERVER'S scope
 * note, which answer different questions and must stay on separate lines.
 */
export const SplitLede: Story = {
  args: {
    eyebrow: "Overview",
    title: "Where every order sits",
    lede: (
      <>
        <p>
          One column per stage. The machine advances exactly one of them — every other
          column is an order stopped on a person, which is the design, not a backlog.
        </p>
        <p>Showing the orders you are cleared to see.</p>
      </>
    ),
  },
};
