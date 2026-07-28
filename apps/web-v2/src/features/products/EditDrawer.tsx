import { Button } from "../../shared/ui/Button";
import { Drawer, DrawerClose, DrawerPanel } from "../../shared/ui/Drawer";

import { ClientForm } from "./ClientForm";
import { LineForm } from "./LineForm";
import { ProductForm } from "./ProductForm";

export type EditKind = "line" | "product" | "client";

export interface EditTarget {
  kind: EditKind;
  mode: "new" | "edit";
}

/**
 * One drawer, three forms.
 *
 * They share a container because they share a CONSEQUENCE MODEL, and the header
 * is where that gets said once: a record saves directly, a wording change mints
 * a config version. Three separate sheets would mean three places to keep that
 * sentence honest, and the one that fell out of date would be the one somebody
 * read.
 *
 * A drawer rather than a modal because the list behind it is the context —
 * which product codes are taken, which lines already cover this ground — and a
 * modal that blanks the page makes you close it to check and lose the draft.
 */
export function EditDrawer({
  target,
  onClose,
}: {
  target: EditTarget;
  onClose: () => void;
}) {
  const title = `${target.mode === "edit" ? "Edit" : "New"} ${target.kind}`;

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerPanel title={title}>
        {/*
          Esc and the backdrop already dismiss this. The × is here anyway
          because a mouse user is never stranded — a control you can only leave
          by keyboard is a control half the people using it cannot leave.
        */}
        <div className="mb-6 flex justify-end">
          <DrawerClose
            render={
              <Button size="sm" fill="ghost" tone="neutral" aria-label="Close">
                ✕
              </Button>
            }
          />
        </div>

        {target.kind === "line" ? (
          <LineForm editing={target.mode === "edit"} onCancel={onClose} />
        ) : null}
        {target.kind === "product" ? (
          <ProductForm isNew={target.mode === "new"} onCancel={onClose} />
        ) : null}
        {target.kind === "client" ? <ClientForm onCancel={onClose} /> : null}
      </DrawerPanel>
    </Drawer>
  );
}
