/**
 * THE KIT'S PUBLIC SURFACE.
 *
 * Every screen imports from here, never from a component file directly. Two
 * reasons, and the second is the load-bearing one:
 *
 *   - The registry writes `button.tsx`; the previous hand-written kit wrote
 *     `Button.tsx`. On a case-insensitive filesystem those are ONE FILE, and
 *     the collision is silent. A barrel means no screen ever spells a kit
 *     filename, so a future `shadcn add` cannot break an import by casing.
 *   - It is the seam where "this came from the registry" stops mattering. A
 *     screen asks for `Button`; whether that is registry source adapted to the
 *     recipes, or something the registry has no equivalent for, is the kit's
 *     business.
 *
 * WHAT THE REGISTRY DOES NOT HAVE, and is ours:
 *   `Kbd`, `Surface`, `SegmentedControl`, `ProgressMeter` (the 18-dot meter the
 *   design draws, not a bar), and `disabled.ts` — rule 9 as a type, which has
 *   no registry equivalent because `disabled` is a boolean everywhere else.
 */

/* ── rule 9, and the reason this kit has no boolean disabled prop ─────────── */
export { disabledAttributes, type Disablement, type DisabledAttributes } from "./disabled";
export { cx } from "./cx";

/* ── controls ─────────────────────────────────────────────────────────────── */
export { Button, LinkButton, buttonVariants } from "./button";
export { Input } from "./input";
export { Textarea } from "./textarea";
export { Label } from "./label";
export { Checkbox } from "./checkbox";
/* The registry has no group; `field-set.tsx` styles one. See checkbox-group.tsx. */
export { CheckboxGroup, type CheckboxGroupProps } from "./checkbox-group";
export { RadioGroup, RadioGroupItem } from "./radio-group";
export { Switch } from "./switch";
export { Toggle, type ToggleProps } from "./toggle";
export {
  ToggleGroup,
  ToggleGroupItem,
  type ToggleGroupProps,
  type ToggleGroupItemProps,
} from "./toggle-group";

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
/*
 * `Option` is exported ONCE, from `select.tsx`, and `combobox.tsx` re-exports
 * it. The registry shipped two near-identical option components; rule 6's ✓
 * mark is spent in one place or it drifts.
 */
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
/*
 * The table's public surface is THREE names, not eight. There is no
 * `TableHeader`/`TableRow`/`TableCell` for a screen to compose, because a
 * virtualized grid owns its own row rendering — a caller-supplied `<tr>` is
 * exactly what stops it virtualizing. A screen supplies COLUMNS.
 */
export { Table, type TableProps } from "./table";
export { DataCell, statusColumn, type RowStatus, type TableColumn } from "./tableColumns";

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
/* `badgeVariants` is NOT exported: rule 6 makes the capsule a decision, and a
   loose class-string factory is how a decision becomes a copy-paste. The
   `Empty*` slot family is gone with it — `Empty` takes a required `reason`. */
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

/* THE RAIL COLUMN — `sidebar` adapted: no mobile, no cookie, no `dark:`. */
export * from "./sidebar";
