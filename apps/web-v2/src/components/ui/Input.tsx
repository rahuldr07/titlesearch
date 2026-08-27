import type { ReactNode } from "react";
import {
  TextField,
  Label,
  Input as AriaInput,
  Text,
  FieldError,
  type TextFieldProps,
} from "react-aria-components";
import { cx } from "./cx";
import { disabledAttributes, type Disablement } from "./disabled";
import { controlClass, labelClass } from "./fieldChrome";

/**
 * A LABELLED TEXT FIELD, AND THE LABEL IS NOT OPTIONAL.
 *
 * `label` is required rather than `label?`, so a placeholder-only field cannot
 * be built. WCAG 3.3.2 wants a visible label and a placeholder is not one — it
 * vanishes at exactly the moment the reader needs it, which on a form asking
 * for a parcel identifier is the whole time.
 *
 * `labelHidden` exists for the one legitimate case (a search box whose purpose
 * the surrounding chrome already states) and it hides the label VISUALLY only;
 * react-aria still wires it to the input, so the accessible name survives.
 */
export type FieldShellProps = Disablement & {
  readonly label: string;
  readonly labelHidden?: boolean | undefined;
  /** Standing help. Rendered as `aria-describedby`, not as a tooltip. */
  readonly description?: string | undefined;
  /**
   * The SERVER's message. `shared/notify.ts`: the client never authors refusal
   * wording, and a field-level refusal is refusal wording.
   */
  readonly errorMessage?: string | undefined;
};

/** Label + control + description/error, in the order a screen reader wants. */
export function FieldShell({
  label,
  labelHidden,
  description,
  errorMessage,
  disabledBecause,
  children,
}: FieldShellProps & { readonly children: ReactNode }) {
  return (
    <>
      <Label className={cx(labelClass, labelHidden === true && "sr-only")}>{label}</Label>
      {children}
      {/*
       * RULE 9 IN THE FIELD'S OWN CHROME. A `title` tooltip is unreachable on
       * touch and by most screen readers, so a disabled field states its reason
       * INLINE as well. This is why `disabledBecause` reaches the shell and not
       * only the input.
       */}
      {typeof disabledBecause === "string" && disabledBecause.length > 0 && (
        <Text slot="description" className="font-sans text-meta leading-close text-ink-secondary">
          {disabledBecause}
        </Text>
      )}
      {description !== undefined && (
        <Text slot="description" className="font-sans text-meta leading-close text-ink-secondary">
          {description}
        </Text>
      )}
      {errorMessage !== undefined && (
        <FieldError className="font-sans text-meta leading-close text-state-halt">
          {errorMessage}
        </FieldError>
      )}
    </>
  );
}

export type InputProps = Omit<TextFieldProps, "isDisabled" | "className" | "children"> &
  FieldShellProps & {
    readonly placeholder?: string | undefined;
    /**
     * Rule 3: mono is for DATA — order refs, money, citations, hashes,
     * timestamps. A field holding one opts in explicitly; nothing infers it,
     * because a primitive that guessed would be a primitive with domain
     * knowledge.
     */
    readonly data?: boolean | undefined;
  };

export function Input({
  label,
  labelHidden,
  description,
  errorMessage,
  disabledBecause,
  placeholder,
  data,
  ...props
}: InputProps) {
  const shell = { label, labelHidden, description, errorMessage, disabledBecause };
  return (
    <TextField
      {...props}
      {...disabledAttributes(disabledBecause)}
      isInvalid={errorMessage !== undefined}
      className="flex flex-col gap-3"
    >
      <FieldShell {...shell}>
        <AriaInput
          {...(placeholder === undefined ? {} : { placeholder })}
          className={cx(controlClass, data === true && "font-mono")}
        />
      </FieldShell>
    </TextField>
  );
}
