import { queryOptions } from "@tanstack/react-query";
import { LifecycleResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";

/**
 * The census of where every order sits.
 *
 * NOTHING ON THIS BOARD IS DERIVED FROM THE ROWS. Each stage's `count`, the
 * four tallies and the scope sentence are all server figures, and they are not
 * `orders.length`: the order list is scoped to what the caller may see, the
 * census is not. Counting the visible cards instead would silently redefine
 * every number as "what this role can see", so a reviewer and a senior would
 * read two different totals off the same screen and both be told they were
 * looking at the shop.
 *
 * `waited` is server TEXT. There is no clock on this screen and nothing counts
 * up — an elapsed timer on a work item is a pace indicator wearing a helpful
 * hat, and this product does not pace people.
 */
export const lifecycleQuery = queryOptions({
  queryKey: ["lifecycle"],
  queryFn: () => get("/api/lifecycle", LifecycleResponse),
});
