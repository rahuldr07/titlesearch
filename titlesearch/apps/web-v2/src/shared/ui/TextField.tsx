import { cva, type VariantProps } from "class-variance-authority";
import type { InputHTMLAttributes, Ref, TextareaHTMLAttributes } from "react";
import { cn } from "./classNames";

/**
 * Text entry. One `cva` serves both the input and the textarea because the
 * design gives them identical border, radius and padding logic — forking them
 * would duplicate the class string, which §6 forbids.
 *
 * Three things the design does NOT have, and which are therefore absent here:
 *
 *  - no focus ring of its own. The export declares exactly one focus treatment,
 *    the global `:focus-visible` in index.css. Adding a second here would give
 *    inputs a different focus affordance from every other control.
 *  - no hover state. Not drawn anywhere.
 *  - no `:invalid` styling. Validity is signalled by BORDER COLOUR, set by the
 *    caller from server state — never by the browser's own validity pseudo-class,
 *    which would make the client the authority (§9.14).
 *
 * `emphasis` exists because stroke weight carries meaning in this design: 1px
 * is a resting control, 1.5px says "this field is load-bearing / required".
 */
const field = cva(
  [
    "w-full bg-surface-panel text-ink-primary font-sans",
    "placeholder:text-ink-muted",
    // The design declares no transition anywhere.
    "transition-none",
    "disabled:cursor-not-allowed disabled:bg-surface-app disabled:text-ink-muted",
  ],
  {
    variants: {
      size: {
        sm: "px-5 py-4 text-sm rounded-5",
        md: "px-5 py-4 text-base rounded-6",
      },
      tone: {
        neutral: "border-line-strong",
        action: "border-action-border",
        settled: "border-state-settled-border",
        attend: "border-state-attend-border",
        halt: "border-state-halt-border",
      },
      emphasis: {
        // 1px — a resting control
        false: "border",
        // 1.5px — required, or the live choice
        true: "border-(length:--stroke-emphasis)",
      },
    },
    defaultVariants: { size: "md", tone: "neutral", emphasis: false },
  },
);

type FieldVariants = VariantProps<typeof field>;

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "size">,
    FieldVariants {
  className?: string;
  /**
   * React 19 passes `ref` as a normal prop. Declared because a control that
   * opens in response to a keystroke has to take focus — otherwise a keyboard
   * user presses the key and nothing observable happens to them.
   */
  ref?: Ref<HTMLInputElement> | undefined;
}

export function TextField({ size, tone, emphasis, className, type = "text", ...rest }: TextFieldProps) {
  return (
    <input type={type} className={cn(field({ size, tone, emphasis }), className)} {...rest} />
  );
}

export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">,
    FieldVariants {
  className?: string;
}

export function TextArea({ size, tone, emphasis, className, rows = 3, ...rest }: TextAreaProps) {
  return (
    <textarea
      rows={rows}
      // Every textarea in the design is vertical-only; free resize would let a
      // reviewer drag it over the evidence they are supposed to be reading.
      className={cn(field({ size, tone, emphasis }), "resize-y leading-body", className)}
      {...rest}
    />
  );
}
