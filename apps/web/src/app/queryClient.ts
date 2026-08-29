import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../shared/api";

/**
 * Lives in `app/` rather than `shared/` because it is application wiring, and
 * `shared/` is the presentational layer that BRIEF §6 forbids from importing
 * Query at all — `scripts/check-rules.mjs` enforces that, and this file would
 * trip it.
 *
 * NO RETRY ON MUTATIONS. A field decision that failed must surface, not be
 * quietly re-sent: `review-conflict.spec` (3 INVARIANTs) requires a 409 render
 * as an answer with the selection unmoved. Retrying a 409 would either mask it
 * or, worse, succeed on a second attempt against different server state.
 *
 * Queries retry twice, but never on a 4xx — a 403 or 422 is a decision the
 * server made, and asking again does not change it.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status < 500) return false;
          return failureCount < 2;
        },
        // The review workstation loads once and moves field-to-field without
        // touching the network (§7). Refetching under the reviewer would
        // undo that, and can change the answer mid-decision.
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
      mutations: { retry: false },
    },
  });
}
