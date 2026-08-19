import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree";

/**
 * The router itself. The tree lives next door in `routeTree.tsx` because it is
 * a flat list of one-line declarations that grows with every screen, and mixing
 * it with the router's configuration made both harder to scan.
 */
export function createAppRouter() {
  return createRouter({ routeTree, defaultPreload: "intent" });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
