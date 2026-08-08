import { Drawer as BaseDrawer } from "@base-ui/react/drawer";
import type { ReactNode } from "react";
import { cn } from "./classNames";

/**
 * The edit drawer — 460px, right side, `max-width: 92vw`, `--shadow-drawer`,
 * over a `--color-scrim` backdrop. Used for editing a line, a product, a client.
 *
 * Base UI ships a first-class Drawer (stable since 1.3.0), so this is not a
 * hand-rolled sheet: swipe-to-dismiss, focus trapping, scroll locking and
 * nested-drawer handling come with it. Rebuilding those on top of Dialog is how
 * you end up with a drawer that traps focus incorrectly on exactly one screen.
 *
 * 460px is `w-230` on the 2px grid. `92vw` stays a viewport unit — it is a
 * relationship to the window, not a value from the design's scale, so there is
 * no token for it and there should not be.
 *
 * The scrim is `--color-scrim`, a COLOUR token rather than a shadow one: a
 * `bg-*` utility needs a colour namespace, and a shadow-named token would emit
 * nothing while the build stayed green.
 */
export function Drawer({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <BaseDrawer.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {children}
    </BaseDrawer.Root>
  );
}

export function DrawerTrigger({
  render,
  children,
}: {
  render?: React.ReactElement;
  children?: ReactNode;
}) {
  return (
    <BaseDrawer.Trigger {...(render ? { render } : {})}>{children}</BaseDrawer.Trigger>
  );
}

export function DrawerPanel({
  title,
  description,
  className,
  children,
}: {
  /** Required — a dialog with no accessible name is unnavigable by screen reader. */
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <BaseDrawer.Portal>
      <BaseDrawer.Backdrop className="fixed inset-0 z-(--z-overlay) bg-scrim" />
      <BaseDrawer.Viewport className="fixed inset-0 z-(--z-overlay) flex justify-end">
        <BaseDrawer.Popup
          className={cn(
            "h-full w-230 max-w-[92vw] overflow-auto",
            "bg-surface-panel p-11 shadow-drawer",
            className,
          )}
        >
          <BaseDrawer.Title className="text-xl font-semibold text-ink-primary">
            {title}
          </BaseDrawer.Title>
          {description ? (
            <BaseDrawer.Description className="mt-2 text-base text-ink-secondary">
              {description}
            </BaseDrawer.Description>
          ) : null}
          <div className="mt-9">{children}</div>
        </BaseDrawer.Popup>
      </BaseDrawer.Viewport>
    </BaseDrawer.Portal>
  );
}

export function DrawerClose({
  render,
  children,
}: {
  render?: React.ReactElement;
  children?: ReactNode;
}) {
  return (
    <BaseDrawer.Close {...(render ? { render } : {})}>{children}</BaseDrawer.Close>
  );
}
