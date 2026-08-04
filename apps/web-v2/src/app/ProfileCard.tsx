import type { Preferences, Role } from "@titlepipe/contract";
import { ActingAs } from "./ActingAs";
import { initialsOf } from "./identity";
import { ThemeChoice } from "./ThemeChoice";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "../shared/ui/classNames";

/**
 * THE PROFILE CARD — what opens when you click the identity chip in the header.
 *
 * It replaces a THIRTEEN-ROW PLAIN LIST that ran ~880px tall and opened on the
 * word "Account" with no person on it. The name was on the trigger you had just
 * clicked and nowhere in the panel, so the surface that exists to say WHO YOU
 * ARE said it only where you could no longer see it.
 *
 * IT IS A CARD, NOT A MENU, and that is a deliberate register change. The
 * vendored shadcn content paints `rounded-md border shadow-md` — shadcn's
 * scale, never the reskin's, because `components/ui` is exempt from
 * `check:rules` and nothing swept it. Overridden at this call site to the app's
 * own card language: `rounded-8`, `shadow-pop`, and a SUBTLE edge rather than
 * `line-strong`, which is darker than the ground and fences a floating panel
 * into a boxed table cell (`Card`'s own rule).
 *
 * DENSITY COMES FROM GRIDS, NOT FROM SHRINKING TYPE. Five admin destinations
 * and six role chips were eleven stacked rows; as two- and three-column grids
 * they are five, at the same 13px. Nothing here is smaller than it was.
 *
 * "ACTING AS" REMAINS A PREVIEW CONTROL AND STILL SAYS SO — conflict C12, and
 * the honest handling. It changes what THIS CLIENT draws and nothing else: the
 * server enforces authorisation independently and refuses the data regardless of
 * what is selected here. The note stays inside the card, beside the chips it is
 * about, and must not survive cutover to the real API.
 *
 * THE SIGNER'S NAME IS READ-ONLY, from the session. Every consequential write in
 * this product is signed, and a name the client can type is not a signature.
 */
export interface ProfileCardProps {
  actor: string;
  role: Role;
  theme: Preferences["theme"];
  onToggleTheme: () => void;
  onActAs: (role: Role) => void;
  /** Navigates and closes the panel — the panel never routes on its own. */
  onGo: (path: string) => void;
}

const ADMIN = [
  { path: "/people", label: "People" },
  { path: "/clients", label: "Clients" },
  { path: "/audit", label: "Audit" },
  { path: "/rulebook", label: "Rulebook" },
  { path: "/products", label: "Products" },
] as const;

const SECTION = "px-7 py-6";
const HEADING = "mb-4 block text-micro font-semibold uppercase tracking-caps text-ink-muted";
/*
 * NAVIGATION IS A MENU ITEM; A TOGGLE IS NOT. Everything that LEAVES this panel
 * is a `DropdownMenuItem`, which closes the panel on activate and joins the
 * roving focus ring — both correct for a command. The theme segments and the
 * role chips are plain buttons precisely because they must NOT close it: you
 * flip a theme to look at it, and `authz.spec` clicks a role and then presses
 * Escape, which is only meaningful if the panel is still open.
 *
 * Found by driving it: after these became plain buttons the panel stayed open
 * over the screen it had just navigated to, with its own backdrop swallowing
 * every subsequent click.
 */
const LINK =
  "cursor-pointer rounded-4 px-4 py-3 text-sm font-medium text-ink-secondary focus:bg-surface-sunken focus:text-ink-primary";

export function ProfileCard({
  actor,
  role,
  theme,
  onToggleTheme,
  onActAs,
  onGo,
}: ProfileCardProps) {
  return (
    <div data-testid="profile-card" className="flex flex-col">
      {/*
        THE PERSON, FIRST AND LARGEST. A 36px mark — half again the header
        chip's 24 — because in the chip identity is a label beside the work and
        here it is the subject. `session` is the demo's own state, said in words
        rather than implied by a menu item further down.
      */}
      <header className={cn(SECTION, "flex items-center gap-6 bg-surface-sunken")}>
        <span className="flex size-18 shrink-0 items-center justify-center rounded-pill bg-ink-primary text-sm font-semibold tracking-badge text-surface-panel">
          {initialsOf(actor)}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-base font-semibold text-ink-primary">{actor}</span>
          <span className="block text-micro uppercase tracking-caps text-ink-muted">
            {role} · demo session
          </span>
        </span>
      </header>

      <div className={cn(SECTION, "border-t border-line-subtle")}>
        <div className="flex items-center gap-4">
          <DropdownMenuItem className={cn(LINK, "flex-1")} onClick={() => onGo("/profile")}>
            Profile
          </DropdownMenuItem>
          <ThemeChoice theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>

      <div className={cn(SECTION, "border-t border-line-subtle")}>
        <span className={HEADING}>Admin</span>
        <div className="grid grid-cols-2 gap-1">
          {ADMIN.map((item) => (
            <DropdownMenuItem key={item.path} className={LINK} onClick={() => onGo(item.path)}>
              {item.label}
            </DropdownMenuItem>
          ))}
        </div>
      </div>

      <div className={cn(SECTION, "border-t border-line-subtle")}>
        <span className={HEADING}>Acting as</span>
        <ActingAs role={role} onActAs={onActAs} />
      </div>

      <footer className={cn(SECTION, "flex items-center gap-4 border-t border-line-subtle")}>
        <DropdownMenuItem className={cn(LINK, "flex-1")} onClick={() => onGo("/session")}>
          Session ended · demo
        </DropdownMenuItem>
        {/* Halt, not action: signing out ends the session that every signature
            on screen was made under. It is the one destructive thing here. */}
        <DropdownMenuItem
          data-testid="sign-out"
          className="cursor-pointer rounded-4 px-4 py-3 text-sm font-semibold text-state-halt-ink focus:bg-state-halt-surface focus:text-state-halt-ink"
          onClick={() => onGo("/signin")}
        >
          Sign out
        </DropdownMenuItem>
      </footer>
    </div>
  );
}
