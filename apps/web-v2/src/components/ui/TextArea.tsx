import {
  TextField,
  TextArea as AriaTextArea,
  type TextFieldProps,
} from "react-aria-components";
import { cx } from "./cx";
import { FieldShell, type FieldShellProps } from "./Input";
import { controlClass } from "./fieldChrome";
import { disabledAttributes } from "./disabled";

/**
 * Multi-line text, on the same geometry as Input.
 *
 * `rows` rather than an auto-growing textarea: this app's frame is one viewport
 * tall and never scrolls (`styles.css`), so a control that grows without bound
 * pushes its own submit button off the pane. A fixed box that scrolls
 * internally is the behaviour the layout can actually accommodate.
 *
 * `resize-none` follows from the same fact.
 */
export type TextAreaProps = Omit<TextFieldProps, "isDisabled" | "className" | "children"> &
  FieldShellProps & {
    readonly placeholder?: string | undefined;
    readonly rows?: number | undefined;
  };

export function TextArea({
  label,
  labelHidden,
  description,
  errorMessage,
  disabledBecause,
  placeholder,
  rows = 4,
  ...props
}: TextAreaProps) {
  const shell = { label, labelHidden, description, errorMessage, disabledBecause };
  return (
    <TextField
      {...props}
      {...disabledAttributes(disabledBecause)}
      isInvalid={errorMessage !== undefined}
      className="flex flex-col gap-3"
    >
      <FieldShell {...shell}>
        <AriaTextArea
          rows={rows}
          {...(placeholder === undefined ? {} : { placeholder })}
          className={cx(controlClass, "resize-none leading-body")}
        />
      </FieldShell>
    </TextField>
  );
}
