import { useNavigate } from "@tanstack/react-router";
import { ROLES, type Preferences, type Role } from "@titlepipe/contract";
import { useSession } from "../shared/session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "../shared/ui/classNames";

const ADMIN = [
  { path: "/people", label: "People" },
  { path: "/clients", label: "Clients" },
  { path: "/audit", label: "Audit" },
  { path: "/rulebook", label: "Rulebook" },
  { path: "/products", label: "Products & sign-off" },
] as const;

/**
 * Identity, and the admin surfaces that hang off it.
 *
 * "ACTING AS" IS A PREVIEW CONTROL AND SAYS SO IN THE MENU — conflict C12, and
 * the design's own handling, which is the honest one. It changes what THIS
 * CLIENT draws and nothing else: the server enforces authorisation
 * independently and refuses the data regardless of what is selected here. It
 * must not survive cutover to the real API.
 *
 * The signer's name is READ-ONLY, from the session. Every consequential write
 * in this product is signed, and a name the client can type is not a signature.
 *
 * IT RUNS ON THE VENDORED SHADCN MENU, not the hand-wrapped one. The old kit
 * `Menu` used `MenuGroupLabel` as a bare section heading; Base UI's
 * `Menu.GroupLabel` reads its id off `Menu.Group`'s context and throws
 * synchronously without one, which unmounted the whole chrome on a click with
 * nothing in the UI to say why. A composition rule that has to be remembered at
 * every call site is a rule that gets forgotten — the registry's own component
 * encodes it, and the upgrade path keeps encoding it.
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
  const initials = actor
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const go = (path: string) => () => void navigate({ to: path });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="account-menu"
          className="flex items-center gap-3 rounded-4 border border-line-strong bg-surface-panel py-2 pl-2 pr-4"
        >
          <span className="flex size-8 items-center justify-center rounded-3 bg-action text-micro font-semibold text-ink-on-action">
            {initials}
          </span>
          <span className="text-left leading-tight">
            <span className="block text-micro font-semibold text-ink-primary">{actor}</span>
            <span className="block text-micro tracking-label uppercase text-ink-muted">{role}</span>
          </span>
          <span aria-hidden className="text-micro text-ink-muted">▾</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuItem onClick={go("/profile")}>Profile</DropdownMenuItem>
          <DropdownMenuItem data-testid="theme-toggle" onClick={onToggleTheme}>
            {theme === "mocha" ? "Switch to TitlePipe theme" : "Switch to Mocha theme"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Admin</DropdownMenuLabel>
          {ADMIN.map((item) => (
            <DropdownMenuItem key={item.path} onClick={go(item.path)}>
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Acting as</DropdownMenuLabel>
          <p className="mx-3 mb-3 rounded-3 border border-state-attend-border bg-state-attend-surface px-4 py-2 text-micro leading-body text-state-attend-ink">
            Preview control — not in production. The server enforces authorization
            independently; this only previews the gates.
          </p>
          <div className="flex flex-wrap gap-2 px-3 pb-3">
            {ROLES.map((candidate: Role) => (
              <button
                key={candidate}
                type="button"
                data-testid={`role-${candidate}`}
                onClick={() => actAs(candidate)}
                className={cn(
                  "rounded-3 border px-3 py-1 text-micro font-semibold",
                  candidate === role
                    ? "border-action bg-action-surface text-action-ink"
                    : "border-line-strong text-ink-secondary",
                )}
              >
                {candidate}
              </button>
            ))}
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={go("/session")}>Session ended · demo</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={go("/signin")}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
