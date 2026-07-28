import { useState } from "react";
import { PACKAGE_PAGES, PRODUCT_NAME, RECORDED_WHEN, type Gap } from "./gapFixtures";

/**
 * How each gap was closed, and what closing it cost.
 *
 * CLOSURES ARE KEPT, NOT COLLAPSED INTO "resolved". The four ways out are not
 * equivalent — a document arriving is evidence, an amended answer is a change
 * to a signed assertion, a root-of-title is a new claim, and a product change
 * moves money. A single "closed" flag would erase exactly the distinction the
 * order's history is supposed to carry.
 *
 * CONTRACT GAP: no endpoint accepts any of these. There is no supplemental
 * upload, no sign-off amendment, no root-of-title assertion and no product
 * change in `packages/contract`, so all four live in this component tree only
 * and vanish on reload. In the product every one of them is an append-only
 * server record — none is a UI state.
 */
export type GapClosure =
  | { readonly kind: "uploaded" }
  | { readonly kind: "amended"; readonly from: string }
  | { readonly kind: "rooted"; readonly comment: string; readonly by: string }
  | { readonly kind: "product-changed" };

export interface ProductChangeRecord {
  readonly from: string;
  readonly to: string;
  readonly by: string;
  readonly when: string;
  readonly reason: string;
}

export function useGateState() {
  const [closures, setClosures] = useState<Record<string, GapClosure>>({});
  const [packagePages, setPackagePages] = useState(PACKAGE_PAGES);
  const [productChange, setProductChange] = useState<ProductChangeRecord | null>(null);

  const close = (gap: Gap, closure: GapClosure) =>
    setClosures((prev) => ({ ...prev, [gap.id]: closure }));

  return {
    closures,
    packagePages,
    productChange,
    /** A supplement is ADDED to the package. It never replaces what arrived. */
    upload: (gap: Gap) => {
      close(gap, { kind: "uploaded" });
      setPackagePages((pages) => pages + gap.docPages);
    },
    amend: (gap: Gap) => close(gap, { kind: "amended", from: gap.answeredAs ?? "YES" }),
    recordRoot: (gap: Gap, comment: string, by: string) =>
      close(gap, { kind: "rooted", comment, by }),
    /**
     * The gap disappears because the ordered period changed underneath it — the
     * search was never short of what the client now bought. The change itself
     * stays visible on the order, which is the part that matters.
     */
    changeProduct: (gap: Gap, to: string, reason: string, by: string) => {
      close(gap, { kind: "product-changed" });
      setProductChange({ from: PRODUCT_NAME, to, by, when: RECORDED_WHEN, reason });
    },
  };
}
