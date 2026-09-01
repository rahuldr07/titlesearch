import { useQuery } from "@tanstack/react-query";
import { get } from "../shared/api";
import type { ReadDescriptor } from "../shared/queries";

/**
 * Perform a read the descriptor describes. Lives in `app/` because it is the
 * only layer both rules permit: `shared/` may not import react-query, and
 * features may not import each other for the hook that does the fetching.
 * Written once so every read of a descriptor shares one cache.
 */
export function useRead<T>(
  descriptor: ReadDescriptor<T>,
  /** `false` while the read has no subject yet. The only option this hook takes. */
  enabled = true,
) {
  return useQuery({
    queryKey: descriptor.key,
    queryFn: () => get(descriptor.path, descriptor.schema),
    enabled,
  });
}
