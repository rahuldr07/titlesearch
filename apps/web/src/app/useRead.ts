import { useQuery } from "@tanstack/react-query";
import { get } from "../shared/api";
import type { ReadDescriptor } from "../shared/queries";

/**
 * PERFORM A READ THE DESCRIPTOR DESCRIBES. Three lines, and they live in `app/`
 * because two `check-rules` rules pull against each other and this is the only
 * layer both permit.
 *
 * `shared/queries.ts` carries the DESCRIPTION of every read — one path, one
 * cache key, one schema — and deliberately performs none, because
 * `presentational-fetches` forbids `shared/` and `entities/` from importing
 * `@tanstack/react-query` at all. `cross-feature-import` then forbids
 * `features/account` from reaching into `features/hub` for the hook that does
 * the fetching. `app/` is neither presentational nor a feature, and every
 * feature may already import from it (`app/session/permissions`), so the hook
 * sits here and is written once.
 *
 * It was written twice before this: `OrderHubScreen.tsx:142` had a private copy
 * and the account panes were about to add a third. Rule 11 is stated for
 * numbers — "one variable, never two literals" — and `queries.ts` extends it to
 * cache keys with the reason that matters here: two spellings of one read are
 * two caches, and two caches of one response fail silently, as a refetch nobody
 * asked for and a stale value nobody can explain.
 */
export function useRead<T>(descriptor: ReadDescriptor<T>) {
  return useQuery({
    queryKey: descriptor.key,
    queryFn: () => get(descriptor.path, descriptor.schema),
  });
}
