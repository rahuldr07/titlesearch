import { useState } from "react";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { GapOptionButton } from "./GapOptionButton";
import { RootOfTitleForm } from "./RootOfTitleForm";
import { ProductChangeForm } from "./ProductChangeForm";
import type { Gap } from "./gapFixtures";

/**
 * The ways out of one gap, and the two that need something typed first.
 *
 * UPLOADING ADDS, IT NEVER REPLACES. The copy says so on the button because the
 * fear it answers is real: people hesitate to send a supplement in case it
 * overwrites the package they already signed for.
 *
 * The forms open in place rather than in a dialog. Both of them ask for a
 * sentence about a claim on the card above; a modal would cover the very
 * evidence the sentence is supposed to answer.
 */
export function GapCloseOptions({
  gap,
  canChangeProduct,
  onUpload,
  onAmend,
  onRecordRoot,
  onChangeProduct,
}: {
  gap: Gap;
  canChangeProduct: boolean;
  onUpload: () => void;
  onAmend: () => void;
  onRecordRoot: (comment: string) => void;
  onChangeProduct: (target: string, reason: string) => void;
}) {
  const [form, setForm] = useState<"none" | "root" | "product">("none");

  return (
    <div>
      <Eyebrow variant="field" as="p" className="mb-4">
        Close it one of two ways
      </Eyebrow>

      <div className="flex flex-wrap gap-5">
        <GapOptionButton
          tone="action"
          title="＋ Upload the missing document"
          sub={`Adds ${gap.docName} to the package — doesn't replace it.`}
          onClick={onUpload}
        />

        {gap.amend === null ? null : (
          <GapOptionButton
            tone="neutral"
            title={gap.amend.label}
            sub={gap.amend.sub}
            onClick={onAmend}
          />
        )}

        {gap.periodAlternatives ? (
          <>
            <GapOptionButton
              tone="settled"
              title="⊢ Root of title reached"
              sub="Asserts the search is complete and nothing older exists. A claim — needs a comment."
              onClick={() => setForm("root")}
            />
            <GapOptionButton
              tone="neutral"
              title="Change the product ordered"
              sub="The client paid for this product. Senior/ops only, with a reason — recorded."
              disabled={!canChangeProduct}
              onClick={() => setForm("product")}
            />
          </>
        ) : null}
      </div>

      {form === "root" ? (
        <RootOfTitleForm onRecord={onRecordRoot} onCancel={() => setForm("none")} />
      ) : null}

      {form === "product" ? (
        <ProductChangeForm onConfirm={onChangeProduct} onCancel={() => setForm("none")} />
      ) : null}
    </div>
  );
}
