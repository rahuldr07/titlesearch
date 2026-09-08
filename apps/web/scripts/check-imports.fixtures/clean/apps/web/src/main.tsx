import { routeTree } from "./app/routeTree";
import type { Thing } from "@titlepipe/contract";

async function start(): Promise<void> {
  if (import.meta.env["VITE_API_MODE"] === "mock") {
    // Dynamic import behind the build-time guard — the sanctioned pattern
    // the prod-reachability rule must NOT flag.
    const { worker } = await import("@titlepipe/mocks/browser");
    worker.start();
  }
  const t: Thing = { id: "t" };
  routeTree(t);
}
void start();
