import { setupServer } from "msw/node";
import { handlers } from "./handlers.js";

/**
 * Node-side counterpart to `browser.ts`, for tests that want the real mock
 * handlers without a Service Worker.
 *
 * `setupServer(...handlers)` must happen here, not in a consumer: msw
 * peer-locks its type declarations to the resolved `typescript` version, so
 * a workspace with two `typescript` versions gets two nominally distinct
 * msw instances, and a consumer passing our `handlers` to its own
 * `setupServer` fails typechecking. Building the server beside the handlers
 * keeps the call inside one msw instance; only `mockServer` crosses the
 * package boundary.
 */
export const mockServer = setupServer(...handlers);
