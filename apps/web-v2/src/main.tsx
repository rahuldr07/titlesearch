import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { createQueryClient } from "./app/queryClient";
import { createAppRouter } from "./app/router";
import "./index.css";

/**
 * MSW is the backend until FastAPI lands (BRIEF §7), reusing `packages/mocks`
 * unforked. It is started BEFORE React mounts — otherwise the first queries
 * race the worker's registration and fail intermittently, which is the kind of
 * flake that gets blamed on the test rather than on the wiring.
 */
async function startMockBackend(): Promise<void> {
  const { worker } = await import("@titlepipe/mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass", quiet: true });
}

async function main(): Promise<void> {
  await startMockBackend();

  const root = document.getElementById("root");
  if (!root) throw new Error("#root is missing from index.html");

  const queryClient = createQueryClient();
  const router = createAppRouter();

  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void main();
