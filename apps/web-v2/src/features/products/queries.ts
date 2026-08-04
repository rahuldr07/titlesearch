import { queryOptions } from "@tanstack/react-query";
import { ConfigResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";

/**
 * The intake config layer — products, sign-off lines and the baseline grid — as
 * ONE response.
 *
 * One request rather than three because they are one decision seen from three
 * sides: a cell in the grid is a line against a product, and fetching them
 * separately would let the screen paint a grid whose columns and rows came from
 * two different config versions. The version is on the response for the same
 * reason — it stamps the whole set, not a table within it.
 *
 * READ ONLY. Publishing a grid, retiring a line and authoring a product are
 * state transitions the server owns and no endpoint accepts yet, so nothing
 * here mutates and every write control on the screen stays disabled.
 */
export const configQuery = queryOptions({
  queryKey: ["config", "products"],
  queryFn: () => get("/api/config/products", ConfigResponse),
});
