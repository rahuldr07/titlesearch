import type { Key } from "react-aria-components";
import { Option, Select } from "../../components/ui";
import { useRead } from "../../app/useRead";
import { productsConfig } from "./configQueries";

/**
 * THE PRODUCT SELECT — the second half of the checklist key, drawn at last.
 *
 * ⚠ RULED 2026-08-29 (RULING-2026-08-29.md): `CreateOrderRequest` carries
 * `product` now, so the gap card that stood here is retired. The options are
 * `GET /api/config/products`' own grid — "Current Owner Search · Current owner
 * — vesting deed + open matters", the reference's "name · scope" register with
 * the server's strings — and a retired product is NOT offered: nothing may be
 * ordered under a shape the config has withdrawn.
 *
 * NO PRODUCT IS PRE-SELECTED, for the client select's reason: the absence
 * reaches the server as an absence, and the server names it (INVARIANTS 60-61).
 */
export function ProductSelect(props: {
  readonly value: string;
  readonly onChange: (productId: string) => void;
}) {
  const config = useRead(productsConfig);

  if (config.data === undefined) {
    return (
      <p
        data-testid="product-select-unread"
        className="font-sans text-meta leading-close text-ink-faint"
      >
        {config.isError
          ? "The product grid could not be read. Nothing here may be typed in its place."
          : "Reading the product grid…"}
      </p>
    );
  }

  return (
    <div data-testid="product-select">
      <Select
        label="Product"
        placeholder="Choose the product…"
        selectedKey={props.value === "" ? null : props.value}
        onSelectionChange={(key: Key | null) =>
          props.onChange(key === null ? "" : String(key))
        }
      >
        {config.data.products
          .filter((product) => !product.retired)
          .map((product) => (
            <Option key={product.id} id={product.id}>
              {`${product.full} · ${product.sub}`}
            </Option>
          ))}
      </Select>
    </div>
  );
}
