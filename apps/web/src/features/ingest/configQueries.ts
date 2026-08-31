import { ConfigResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "../../shared/queries";

/**
 * The product grid intake's Product select offers. It lives in the feature
 * rather than `shared/` because intake is its only reader; if a second
 * arrives, this moves there whole, keeping the single spelling of the key.
 */
export const productsConfig: ReadDescriptor<ConfigResponse> = {
  path: "/api/config/products",
  key: ["config", "products"],
  schema: ConfigResponse,
};
