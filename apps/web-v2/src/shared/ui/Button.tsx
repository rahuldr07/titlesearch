import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { buttonClasses, type ButtonTone, type ButtonVariants } from "./buttonClasses";
import { cn } from "./classNames";

/**
 * THE ACCENT DISCIPLINE, AS A DEFAULT INSTEAD OF A CONVENTION.
 *
 * RULE: one solid accent action per screen; everything else is a hairline on
 * bright paper; destructive stays solid. FAILURE PREVENTED: as a house style
 * that rule survives about four screens. Here, a call site that states only
 * what the button MEANS gets the design's loudness for free — `settled` and
 * `attend` come out as outlines, and wax is reachable only via `tone="action"`
 * — the screen's action by definition. A second wax button is then a second
 * bare `<Button>`, visible at the call site rather than an invisible style
 * choice. `fill` still overrides, but `fill="solid" tone="settled"` is a
 * sentence saying "yes, two loud buttons" — the review conversation to have.
 *
 * Module-private for the same reason. `buttonClasses` keeps `fill: "solid"` in
 * its own defaults because six call sites style a `<Link>` with only
 * `size`/`tone` — all six `action` or `halt`, where this map agrees.
 */
const DEFAULT_FILL: Record<ButtonTone, NonNullable<ButtonVariants["fill"]>> = {
  action: "solid",
  halt: "solid",
  settled: "outlined",
  attend: "outlined",
  neutral: "outlined",
};

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">, ButtonVariants {
  children: ReactNode;
  className?: string;
  /**
   * React 19 passes `ref` as a normal prop — no `forwardRef` needed. Declared
   * because focus must be movable onto a button programmatically:
   * `DestructiveConfirm` moves focus to the confirm step when it arms, without
   * which a keyboard user's focus sits on a button whose label silently changed.
   */
  ref?: Ref<HTMLButtonElement> | undefined;
}

export function Button({
  tone = "action",
  fill,
  size,
  block,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        // `?? "action"` covers the null cva allows, which the default cannot.
        buttonClasses({
          tone,
          fill: fill ?? DEFAULT_FILL[tone ?? "action"],
          size,
          block,
        }),
        className,
      )}
      {...rest}
    />
  );
}
