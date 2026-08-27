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
export { RadioGroup, RadioGroupItem } from "./radio-group";
export { Switch } from "./switch";
export { Toggle, toggleVariants } from "./toggle";
export { ToggleGroup, ToggleGroupItem } from "./toggle-group";

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
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectInput,
  SelectItem,
  SelectLabel,
  SelectList,
  SelectPopover,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  SelectEmpty,
} from "./select";
export {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
} from "./combobox";
export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "./command";
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "./table";

/* ── overlays ─────────────────────────────────────────────────────────────── */
export {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
  type DialogPrimitiveProps,
  type DialogTriggerPrimitiveProps,
} from "./dialog";
export {
  Popover,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./popover";
export { Tooltip, TooltipTrigger } from "./tooltip";

/* ── navigation ───────────────────────────────────────────────────────────── */
export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants } from "./tabs";

/* ── display ──────────────────────────────────────────────────────────────── */
export { Badge, badgeVariants } from "./badge";
export { Separator } from "./separator";
export { Skeleton } from "./skeleton";
export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from "./empty";
export { Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue } from "./progress";
