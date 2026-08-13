import { useNavigate } from "@tanstack/react-router";
import type { Preferences, Role } from "@titlepipe/contract";
import { useSession } from "../../shared/session";
import { initialsOf } from "../../shared/identity";
import { ProfileCard } from "./ProfileCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Identity in the header, and the profile card that opens from it.
 *
 * THIS FILE IS NOW WIRING ONLY. It used to hold the trigger, five admin links,
 * six role chips, a theme sentence and a preview note in one 145-line component
 * — which is why the panel drifted out of the design without anyone noticing.
 * The panel's own reasoning lives in `ProfileCard`; the chip's lives below.
 *
 * IT RUNS ON THE VENDORED SHADCN MENU, not the hand-wrapped one. The old kit
 * `Menu` used `MenuGroupLabel` as a bare section heading; Base UI's
 * `Menu.GroupLabel` reads its id off `Menu.Group`'s context and throws
 * synchronously without one, which unmounted the whole chrome on a click with
 * nothing in the UI to say why. A composition rule that has to be remembered at
 * every call site is a rule that gets forgotten — the registry's own component
 * encodes it, and the upgrade path keeps encoding it.
 *
 * THE PANEL MIXES MENU ITEMS AND PLAIN BUTTONS ON PURPOSE, which is why it
 * takes `p-0` and draws its own bands. Anything that LEAVES the panel is a
 * `DropdownMenuItem` — it closes on activate and joins the roving focus ring,
 * both correct for a command. The theme segments and the role chips are plain
 * buttons because they must NOT close it. `ProfileCard` states the rule beside
 * the code that follows it.
 *
 * The menu still owns what it is good at: the trigger pairing, focus capture,
 * click-outside and Escape.
 */
export function AccountMenu({
  theme,
  onToggleTheme,
}: {
  theme: Preferences["theme"];
  onToggleTheme: () => void;
}) {
  const navigate = useNavigate();
  const role = useSession((s) => s.role);
  const actor = useSession((s) => s.actor);
  const actAs = useSession((s) => s.actAs);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        // `data-testid` stays on the TRIGGER: four specs and two stories open
        // this panel by clicking it, and the id is the seam they hold.
        data-testid="account-menu"
        className="flex items-center gap-3 rounded-4 border border-line-strong bg-surface-panel py-1 pl-1 pr-4 hover:bg-surface-sunken"
      >
        {/*
         * THE MOCKUP'S `.who`: a 24px ROUND avatar in primary ink, an 11.5px
         * name, an 8.5px tracked role. RULE: the sealing wax is spent once per
         * screen, on the one action. FAILURE PREVENTED: the avatar was
         * `bg-action` — a wax lozenge in the chrome of EVERY screen, so no
         * screen could honestly claim one accent. An identity mark is the
         * person, not an alarm, and the mockup fills it with `--ink`.
         */}
        <span className="flex size-12 items-center justify-center rounded-pill bg-ink-primary text-micro font-semibold tracking-badge text-surface-panel">
          {initialsOf(actor)}
        </span>
        {/* `leading-tight`, so the two lines occupy the 24px the avatar beside
            them does — the mockup sets `.w-name` at 1.2 and `.w-role` at 1. */}
        <span className="text-left leading-tight">
          <span className="block text-sm font-semibold text-ink-primary">{actor}</span>
          <span className="block text-micro tracking-caps uppercase text-ink-muted">
            {role}
          </span>
        </span>
        <span aria-hidden className="text-micro text-ink-muted">
          ▾
        </span>
      </DropdownMenuTrigger>
      {/*
        THE APP'S CARD LANGUAGE, IMPOSED HERE. The vendored content ships
        shadcn's `rounded-md border shadow-md`; `components/ui` is exempt from
        `check:rules`, so the 2026-08-01 reskin never reached it and this panel
        stayed a default dropdown on a page of soft-shadowed cards. `p-0`
        because the card draws its own bands edge to edge.
      */}
      {/*
        `w-170` IS 340px, NOT 170. Every width here multiplies `--spacing`,
        which this app sets to 2px (`index.css`) so the mockup's odd densities
        are expressible without arbitrary values. `w-96` — copied from shadcn's
        own examples, where the base is 4px — therefore drew a 192px panel, and
        at that width the identity line, the footer and every chip wrapped. The
        trap is silent: the class is valid, the panel renders, it is simply half
        the intended size. Any width lifted from shadcn or Tailwind docs needs
        doubling before it means what it says here.
      */}
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-170 overflow-hidden rounded-8 border-line-subtle p-0 shadow-pop"
      >
        <ProfileCard
          actor={actor}
          role={role}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onActAs={(next: Role) => actAs(next)}
          onGo={(path) => void navigate({ to: path })}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
