import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import "./index.css";

const queryClient = new QueryClient();

/**
 * Local-first phase: MSW is the backend. Handlers are deleted route-by-route
 * as the FastAPI core-api lands (frontend-first strategy, HANDOFF §5).
 */
async function start() {
  const { worker } = await import("@titlepipe/mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass" });

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void start();
