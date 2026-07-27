import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ReactNode } from "react";
import { cn } from "./classNames";

/**
 * The account menu — 256px, panel surface, `--shadow-menu`, sitting at z-index
 * 40 in the design. One of only four things in the whole export that carries a
 * shadow, because it genuinely floats.
 *
 * Menu items are the only place the design draws a hover state on a control:
 * `background: var(--ground)` on hover, and `--red-tint` on Sign out. Base UI
 * exposes keyboard-or-pointer highlight as `data-highlighted`, which is the
 * correct target — styling `:hover` alone would leave keyboard users with no
 * indication of where they are.
 */
export function Menu({ children }: { children: ReactNode }) {
  return <BaseMenu.Root>{children}</BaseMenu.Root>;
}

/**
 * `render` is Base UI's polymorphism escape hatch — it replaces the rendered
 * element rather than wrapping it, so the trigger can BE a Button instead of
 * containing one. That matters for a11y: a button inside a button is invalid
 * markup and screen readers announce it unpredictably.
 */
export function MenuTrigger({
  render,
  className,
  children,
}: {
  render?: React.ReactElement;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <BaseMenu.Trigger className={className} {...(render ? { render } : {})}>
      {children}
    </BaseMenu.Trigger>
  );
}

export function MenuPopup({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner sideOffset={6} align="end" className="z-(--z-popup)">
        <BaseMenu.Popup
          className={cn(
            "w-128 rounded-9 border border-line-strong bg-surface-panel p-3 shadow-menu",
            className,
          )}
        >
          {children}
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}

export function MenuItem({
  tone = "neutral",
  onClick,
  className,
  children,
}: {
  tone?: "neutral" | "halt";
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <BaseMenu.Item
      onClick={onClick}
      className={cn(
        "w-full cursor-default rounded-5 px-5 py-4 text-left text-base",
        tone === "neutral" && "text-ink-primary data-highlighted:bg-surface-app",
        tone === "halt" &&
          "font-semibold text-state-halt-ink data-highlighted:bg-state-halt-surface",
        className,
      )}
    >
      {children}
    </BaseMenu.Item>
  );
}

export function MenuSeparator() {
  return <BaseMenu.Separator className="mx-3 my-2 h-px bg-line-subtle" />;
}

export function MenuGroupLabel({ children }: { children: ReactNode }) {
  return (
    <BaseMenu.GroupLabel className="px-5 py-3 text-micro font-bold tracking-label text-ink-muted uppercase">
      {children}
    </BaseMenu.GroupLabel>
  );
}
