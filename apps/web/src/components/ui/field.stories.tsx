import type { Meta, StoryObj } from "@storybook/react-vite";
import { PanelGround } from "./panel-ground";
import { TextField } from "react-aria-components";
import {
  Field,
  FieldContent,
  FieldTitle,
  FieldDescription,
  FieldError,
  FieldSet,
  FieldLegend,
  FieldGroup,
  FieldSeparator,
} from "./field";
import { Label } from "./label";
import { Input } from "./input";

const meta = {
  title: "ui/Field",
  component: Field,
  decorators: [
    (Story) => (
      <PanelGround>
        <Story />
      </PanelGround>
    ),
  ],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The vertical field: 11px label, 36px control, 13px help. */
export const Vertical: Story = {
  render: () => (
    <Field className="w-90">
      <TextField className="flex flex-col gap-3">
        <Label>Instrument number</Label>
        <Input data placeholder="e.g. 2019-0043117" />
        <FieldDescription>As printed on the recorder's stamp.</FieldDescription>
      </TextField>
    </Field>
  ),
};

/**
 * Horizontal: the name sits beside the value, so it is a 13px `FieldTitle`.
 *
 * `FieldTitle` renders a `div`, which gives NO accessible name — axe caught
 * exactly that here. So it carries an `id` and the control points at it with
 * `aria-labelledby`. A `Label` is simpler, but a horizontal row's name is
 * often shared by several controls, which is what `FieldTitle` is for.
 */
export const Horizontal: Story = {
  render: () => (
    <Field orientation="horizontal" className="w-140">
      <FieldContent>
        <FieldTitle id="vesting-deed">Vesting deed</FieldTitle>
        <FieldDescription>Read from the chain, not entered.</FieldDescription>
      </FieldContent>
      <Input data defaultValue="2016-0881204" className="w-70" aria-labelledby="vesting-deed" />
    </Field>
  ),
};

/** Rule 9 inline: the reason a control is refused, in the description slot. */
export const BlockedWithReason: Story = {
  render: () => (
    <Field className="w-90">
      <TextField isDisabled className="flex flex-col gap-3">
        <Label>Instrument number</Label>
        <Input
          data
          defaultValue="2019-0043117"
          disabledBecause="Read from the clerk stamp."
        />
        <FieldDescription>Read from the clerk stamp — not editable.</FieldDescription>
      </TextField>
    </Field>
  ),
};

/** The server's refusal wording. The client never authors it (shared/notify). */
export const Invalid: Story = {
  render: () => (
    <Field data-invalid="true" className="w-90">
      <TextField isInvalid className="flex flex-col gap-3">
        <Label>Instrument number</Label>
        <Input data defaultValue="2019-43117" aria-invalid />
        <FieldError>Not found in the county package for Maricopa.</FieldError>
      </TextField>
    </Field>
  ),
};

/** More than one refusal on one field, as a list rather than as a paragraph. */
export const MultipleErrors: Story = {
  render: () => (
    <Field className="w-90">
      <FieldTitle>Recording reference</FieldTitle>
      <FieldError
        errors={[
          { message: "Book and page do not both parse." },
          { message: "Year is before the county's earliest index (1871)." },
        ]}
      />
    </Field>
  ),
};

/** A set with a subject legend, a group, and a labelled separator. */
export const Grouped: Story = {
  render: () => (
    <FieldSet className="w-140">
      <FieldLegend>Recording reference</FieldLegend>
      <FieldGroup>
        <Field>
          <TextField className="flex flex-col gap-3">
            <Label>Instrument number</Label>
            <Input data placeholder="2019-0043117" />
          </TextField>
        </Field>
        <FieldSeparator>or</FieldSeparator>
        <Field orientation="responsive">
          <TextField className="flex flex-col gap-3">
            <Label>Book</Label>
            <Input data placeholder="4412" />
          </TextField>
          <TextField className="flex flex-col gap-3">
            <Label>Page</Label>
            <Input data placeholder="118" />
          </TextField>
        </Field>
      </FieldGroup>
    </FieldSet>
  ),
};

/** The legend's other spelling: 11px w700 grey, for a sub-band inside a set. */
export const LabelLegend: Story = {
  render: () => (
    <FieldSet className="w-90">
      <FieldLegend variant="label">Second reading</FieldLegend>
      <FieldDescription>
        Countersign must come from a different examiner.
      </FieldDescription>
    </FieldSet>
  ),
};
