import { setupServer } from "msw/node";
import { handlers } from "./handlers.js";

/**
 * Node-side counterpart to `browser.ts`, for tests that want the real mock
 * handlers without a Service Worker.
 *
 * `setupServer(...handlers)` must happen HERE, not in a consumer. msw peer-
 * locks its own type declarations to the resolved `typescript` version
 * (`peerDependenciesMeta.typescript`), so a workspace with two different
 * `typescript` devDependency versions gets two structurally-identical but
 * NOMINALLY DISTINCT `msw` instances. A consumer that imports `handlers`
 * from this package and passes them to its OWN `setupServer` call is
 * comparing `HttpHandler` from one instance against `AnyHandler` from the
 * other — TypeScript correctly refuses that (`protected` members require
 * the same declaring class). Building the server in the same module that
 * builds the handlers keeps the whole call inside one msw instance; only the
 * resulting `mockServer` (whose `listen`/`resetHandlers`/`close` take no
 * handler arguments) crosses the package boundary.
 */
export const mockServer = setupServer(...handlers);
