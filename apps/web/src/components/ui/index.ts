/**
 * The kit's public surface. Every screen imports from here, never from a
 * component file directly: filenames in this directory have collided by
 * casing on case-insensitive filesystems, and a barrel means no screen ever
 * spells a kit filename.
 */

/* ── disabled: this kit has no boolean disabled prop ──────────────────────── */
export { disabledAttributes, type Disablement, type DisabledAttributes } from "./disabled";
export { cx } from "./cx";

/* ── controls ─────────────────────────────────────────────────────────────── */
export { Button, LinkButton } from "./button";
export { buttonVariants } from "./button-chrome";
export { Input } from "./input";
export { Textarea } from "./textarea";
export { Label } from "./label";
export { Checkbox } from "./checkbox";
export { CheckboxGroup, type CheckboxGroupProps } from "./checkbox-group";
export { RadioGroup, RadioGroupItem } from "./radio-group";
export { Switch } from "./switch";
export { Toggle, type ToggleProps } from "./toggle";

/* ── fields: label + control + description + error, as one unit ───────────── */
export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
} from "./field";
export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
} from "./input-group";

/* ── collections ──────────────────────────────────────────────────────────── */
/* `Option` is exported once, from select.tsx — one option component, one ✓
   mark, or the mark drifts. */
export { Select, Option, type SelectProps, type OptionProps } from "./select";
export { ComboBox, type ComboBoxProps } from "./combobox";
export { CommandPalette, type CommandPaletteProps } from "./commandPalette";
export {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  type CommandItemProps,
} from "./command";
/* No TableHeader/TableRow/TableCell to compose: a virtualized grid owns its
   own row rendering, and a caller-supplied <tr> is exactly what stops it
   virtualizing. A screen supplies columns. */
export { Table, type TableProps } from "./table";
export { statusColumn, type ColumnAlign, type RowStatus, type TableColumn } from "./tableColumns";
export { DataCell } from "./dataCell";

/* ── overlays ─────────────────────────────────────────────────────────────── */
export { Dialog, DialogBody, DialogFooter, DialogTrigger, type DialogProps } from "./dialog";
export {
  Popover,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  type SurfacePopoverProps,
} from "./popover";
export { Tooltip, TooltipTrigger, type ChipTooltipProps } from "./tooltip";

/* ── navigation ───────────────────────────────────────────────────────────── */
export { BreadcrumbTrail, BreadcrumbItem, BreadcrumbLink, BreadcrumbCurrent,
  BreadcrumbSeparator, type BreadcrumbTrailProps } from "./breadcrumb";
export {
  Tabs,
  TabList,
  Tab,
  TabPanel,
  type TabsProps,
  type TabProps,
  type TabPanelProps,
} from "./tabs";

/* ── display ──────────────────────────────────────────────────────────────── */
/* `badgeVariants` is deliberately not exported: the capsule is a decision,
   and a loose class-string factory is how a decision becomes a copy-paste. */
export { Badge, StatusMark, type Mark, type BadgeProps } from "./badge";
export { Separator } from "./separator";
export { Skeleton } from "./skeleton";
export { Empty } from "./empty";
export { Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue } from "./progress";
/* The one the screens use. `progress` above is the bar, for continuous work. */
export { ProgressMeter, type ProgressMeterProps } from "./progress-meter";
export { Kbd } from "./kbd";
export { Card, CardHeader, CardBody, InnerPanel, type CardProps } from "./card";
export { SegmentedControl, Segment, type SegmentedControlProps, type SegmentProps } from "./segmented-control";
export { Alert, type AlertProps, type AlertTone } from "./alert";
export { Avatar, AvatarLabel, type AvatarProps } from "./avatar";
export { Spinner, type SpinnerProps } from "./spinner";
export { ScrollArea, type ScrollAreaProps } from "./scroll-area";
export { Split, SplitPanel, SplitHandle, type SplitProps, type SplitPanelProps } from "./resizable";
export { DECISION_MIN, DECISION_MAX } from "./splitBand";
/* The rail column. */
export * from "./sidebar";
export { useSidebar, SIDEBAR_KEY } from "./sidebar-context";
