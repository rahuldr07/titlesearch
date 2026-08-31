import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../shared/api";

/**
 * Lives in `app/` rather than `shared/` because it is application wiring —
 * `shared/` may not import Query at all.
 *
 * No retry on mutations: a field decision that failed must surface, not be
 * quietly re-sent — retrying a 409 would mask it or succeed against
 * different server state. Queries retry twice, but never on a 4xx: a 403 or
 * 422 is a decision the server made, and asking again does not change it.
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
        // touching the network. Refetching under the reviewer would undo
        // that, and can change the answer mid-decision.
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
      mutations: { retry: false },
    },
  });
}
