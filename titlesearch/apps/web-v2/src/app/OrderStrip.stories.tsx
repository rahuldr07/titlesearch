import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { Field, OrderContextResponse, PreferencesResponse } from "@titlepipe/contract";
import { OrderStrip } from "./OrderStrip";

const ORDER_ID = "ord_demo_1";

/** Two fields is enough to prove the four count labels render — `OrderCounts`
 * already carries its own numeric logic and its own coverage. */
const FIELDS: Field[] = [
  {
    id: "f1", order_id: ORDER_ID, path: "owner.name", value: "J. Rivera",
    na_reason: null, state: "auto_confirmed", source_doc_id: "doc1",
    source_page: 1, source_snippet: "…", source_line_coords: null,
    engine_id: "e1", engine_confidence_raw: 0.9, rule_refs: [],
    approved_by: null, approved_at: null,
  },
  {
    id: "f2", order_id: ORDER_ID, path: "owner.address", value: null,
    na_reason: null, state: "needs_review", source_doc_id: null,
    source_page: null, source_snippet: null, source_line_coords: null,
    engine_id: null, engine_confidence_raw: null, rule_refs: [],
    approved_by: null, approved_at: null,
  },
];

/**
 * The order's own context, as `GET /api/orders/{id}/context` serves it. The
 * ref is the export's own number for this order and the stamp arrives
 * DECIDED — label and tone — which is the point of the story: the strip
 * prints what it was handed and composes no lifecycle word of its own.
 */
const CONTEXT: OrderContextResponse = {
  order_id: ORDER_ID,
  order_ref: "4176034-1",
  product: "40-Year Search",
  period_label: "40-year period · 07/18/1986 – 07/18/2026",
  pages: 64,
  stamp: { label: "Package incomplete", tone: "halt" },
};

const PREFERENCES: PreferencesResponse = {
  // `null` is the untouched preference — see `preferences.ts`. The strip does
  // not read it, but the story seeds the real shape rather than a chosen one.
  preferences: { nav_collapsed: null, reduced_motion: false, default_zoom: 1, theme: "titlepipe" },
};

/**
 * `OrderStrip` reads the URL and two queries itself (§11 2026-07-30 revision),
 * so its story needs a real (if minimal) Router + QueryClient rather than
 * plain props — unlike this repo's usual presentational stories. The
 * QueryClient is PRE-SEEDED at the same query keys the component fetches
 * (`staleTime: Infinity` so nothing refetches over the network mid-test); the
 * router is a single bare root route so `useRouterState`/`useNavigate` resolve
 * without pulling in every real screen.
 */
function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  queryClient.setQueryData(["orders", ORDER_ID, "fields"], { order_id: ORDER_ID, fields: FIELDS });
  queryClient.setQueryData(["orders", ORDER_ID, "context"], CONTEXT);
  queryClient.setQueryData(["me", "preferences"], PREFERENCES);
  const rootRoute = createRootRoute({ component: OrderStrip });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

const meta = {
  title: "App/OrderStrip",
  component: OrderStrip,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof OrderStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** On an order screen: the ref, the four counts, the stamp, the account trigger. */
export const OnAnOrderScreen: Story = {
  render: () => renderAt(`/orders/${ORDER_ID}/review`),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const strip = await canvas.findByTestId("order-strip");
    // The HUMAN ref, and the URL id nowhere on the strip — the assertion is
    // both halves, because printing the id was the defect.
    await expect(strip).toHaveTextContent(`ORDER ${CONTEXT.order_ref}`);
    expect(strip).not.toHaveTextContent(ORDER_ID);
    const counts = await canvas.findByTestId("order-counts");
    for (const label of ["Fields", "Auto-confirmed", "Need you", "No source"]) {
      expect(counts).toHaveTextContent(label);
    }
    await expect(canvas.findByText(CONTEXT.stamp.label)).resolves.toBeInTheDocument();
    await expect(canvas.findByTestId("account-menu")).resolves.toBeInTheDocument();
  },
};

/** Off an order screen: identity only — no order label, no counts, no stamp. */
export const OffAnOrderScreen: Story = {
  render: () => renderAt("/queue"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.findByTestId("account-menu")).resolves.toBeInTheDocument();
    expect(canvas.queryByText(/^ORDER /)).not.toBeInTheDocument();
    expect(canvas.queryByTestId("order-counts")).not.toBeInTheDocument();
  },
};
