import type { Key } from "react-aria-components";
import { Option, Select } from "../../components/ui";
import { useRead } from "../../app/useRead";
import { productsConfig } from "./configQueries";

/**
 * The product select — the second half of the checklist key. A retired
 * product is not offered: nothing may be ordered under a shape the config has
 * withdrawn. No product is pre-selected, for the client select's reason: the
 * absence reaches the server as an absence, and the server names it.
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
