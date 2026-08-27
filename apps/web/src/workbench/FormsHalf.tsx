import { TextField } from "react-aria-components";

import { Row } from "./Row";
import {
  ComboBox,
  Command,
  CommandInput,
  CommandItem,
  CommandList,
  Field,
  FieldDescription,
  FieldError,
  FieldSeparator,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  Label,
  Option,
  Select,
  Textarea,
} from "../components/ui";

/**
 * THE FORM HALF: the things a reader TYPES into.
 *
 * Split from `main.tsx` on the 150-line gate, and the seam is the same one the
 * kit itself draws — `field.tsx` and `input-group.tsx` exist because a control
 * is never alone on a screen, it is a label plus a control plus, sometimes, a
 * refusal. So the bands below always show the composition, never a naked
 * `Input`: an input drawn without its label is the one arrangement that never
 * ships, and eyeballing it proves nothing.
 */
export function FormsHalf() {
  return (
    <>
      <Row title="Text entry" note="type here, then press a chord key — it must stay text">
        <Field className="w-140">
          <TextField className="flex flex-col gap-3">
            <Label>Order reference</Label>
            <Input data placeholder="TP-0000-0000" />
            <FieldDescription>As printed on the intake sheet.</FieldDescription>
          </TextField>
        </Field>
        <Field className="w-140">
          <TextField className="flex flex-col gap-3" isInvalid>
            <Label>Refused</Label>
            <Input data defaultValue="BK 0000 PG 00" />
            {/* The SERVER's wording. The client never authors a refusal. */}
            <FieldError>The server refused this value.</FieldError>
          </TextField>
        </Field>
        <Field className="w-160">
          <TextField className="flex flex-col gap-3">
            <Label>Reason</Label>
            <Textarea placeholder="Why this correction?" />
          </TextField>
        </Field>
        <Field className="w-140">
          <TextField isDisabled className="flex flex-col gap-3">
            <Label>Read from the stamp</Label>
            <Input data defaultValue="0000-0000000" disabledBecause="Blocked: read from the clerk stamp." />
            <FieldDescription>Blocked: read from the clerk stamp.</FieldDescription>
          </TextField>
        </Field>
      </Row>

      <Row title="Input group" note="the WRAPPER owns the box — focus is drawn once, not twice">
        <InputGroup className="w-140">
          <InputGroupAddon>
            <InputGroupText>◆</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput aria-label="Search orders" placeholder="Search orders" />
        </InputGroup>
        <InputGroup className="w-140">
          <InputGroupInput aria-label="Consideration" data defaultValue="000,000.00" />
          <InputGroupAddon align="inline-end">
            <InputGroupButton>Clear</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </Row>

      <Row title="Choice" note="open one and type — its typeahead must own the keys">
        <div className="w-120">
          <Select label="Absence" defaultSelectedKey="b">
            <Option id="a">Not used in this jurisdiction</Option>
            <Option id="b">Searched — nothing of record</Option>
            <Option id="c">Instrument is silent on it</Option>
            <Option id="d">On the page — could not be read</Option>
          </Select>
        </div>
        <div className="w-120">
          <ComboBox label="County">
            <Option id="a">Specimen county A</Option>
            <Option id="b">Specimen county B</Option>
            <Option id="c">Specimen county C</Option>
          </ComboBox>
        </div>
        <div className="w-120">
          <Select label="Blocked" disabledBecause="Blocked: no package loaded.">
            <Option id="a">Nothing to choose</Option>
          </Select>
        </div>
      </Row>

      <Row title="Command" note="inline, not the overlay — the same filter, on a panel">
        <div className="w-210 rounded-lg border border-line-subtle bg-surface-panel">
          <Command>
            <CommandInput />
            <CommandList aria-label="Commands">
              <CommandItem id="confirm" keys="c">Confirm the reading</CommandItem>
              <CommandItem id="escalate" keys="e">Escalate to a rule</CommandItem>
              <CommandItem id="next" keys="j">Next field</CommandItem>
            </CommandList>
          </Command>
        </div>
      </Row>

      <Row title="Separator" note="a hairline divides an interior — depth separates a surface">
        <div className="w-210">
          <FieldSeparator>or</FieldSeparator>
        </div>
      </Row>
    </>
  );
}
