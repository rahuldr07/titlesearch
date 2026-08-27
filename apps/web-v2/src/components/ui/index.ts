/**
 * THE KIT'S PUBLIC SURFACE.
 *
 * A barrel, and the one thing worth knowing about it: `check-rules.mjs` states
 * plainly that "a cross-feature import laundered through a re-export barrel is
 * not detected. That needs a real module graph; this is a line scanner." This
 * barrel is safe from that hole only because everything behind it is a
 * PRIMITIVE with zero domain knowledge — there is no feature here to launder.
 * The moment something domain-aware is added below, that stops being true, and
 * the answer is that it does not belong in this directory at all.
 *
 * `disabled.ts` is exported deliberately: a screen composing its own control
 * should reach for the same `Disablement` type rather than inventing a second
 * spelling of rule 9.
 */

export { cx } from "./cx";
export { disabledAttributes, type Disablement, type DisabledAttributes } from "./disabled";

export { Button, type ButtonProps } from "./Button";
export { Input, FieldShell, type InputProps } from "./Input";
export { controlClass, labelClass, listBoxClass } from "./fieldChrome";
export { TextArea, type TextAreaProps } from "./TextArea";
export { Select, type SelectProps } from "./Select";
export { ComboBox, type ComboBoxProps } from "./ComboBox";
export { Option, ListBox, type OptionProps } from "./Option";
export { Checkbox, CheckboxGroup, type CheckboxProps, type CheckboxGroupProps } from "./Checkbox";
export { RadioGroup, Radio, type RadioGroupProps, type RadioProps } from "./RadioGroup";
export { Switch, type SwitchProps } from "./Switch";

export { Card, InnerPanel, type CardProps } from "./Surface";
export { Divider, type DividerProps } from "./Divider";
export { Kbd } from "./Kbd";
export { Badge, StatusMark, type BadgeProps, type Mark } from "./Badge";
export { Skeleton } from "./Skeleton";
export { EmptyState } from "./EmptyState";
export { ProgressMeter, type ProgressMeterProps } from "./ProgressMeter";

export { Popover, type SurfacePopoverProps } from "./Popover";
export { Dialog, DialogTrigger, type DialogProps } from "./Dialog";
export { Tooltip, TooltipTrigger, type TooltipProps } from "./Tooltip";
export { Tabs, TabList, Tab, TabPanel, type TabsProps, type TabProps, type TabPanelProps } from "./Tabs";
export {
  SegmentedControl,
  Segment,
  type SegmentedControlProps,
  type SegmentProps,
} from "./SegmentedControl";

export { DataTable, DataCell, type DataTableProps } from "./DataTable";
export { columnsFor, useDataTable, features, type Column, type Features } from "./tableFeatures";
