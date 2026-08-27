import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { GrantedPermissionSchema } from "@titlepipe/contract";
import { DOORS } from "../chrome/doors";
import { hasDoor } from "../session/permissions";
import { useOverlays } from "./overlays";
import { useSignedIn } from "../session/signedIn";

/**
 * WHAT THE PALETTE CAN DO — screens and actions, and deliberately NOT orders.
 *
 * The design asks for "screens, ORDERS, actions (switch user, sign out)". An
 * order switcher needs a list of orders to switch between and there is no such
 * endpoint: `endpoints.ts:69` — "GET /api/queue/next — server-ordered; there is
 * no browse/pick endpoint" — and `endpoints.ts:77-82` records that
 * `/api/queue/bands` is READ SHAPES ONLY, carrying "no claim token, no
 * assignment field, no ordering the caller can influence", so that "no queue
 * cherry-picking holds BY CONSTRUCTION rather than by the screen's restraint."
 * `INVARIANTS:82-83` says the same as a rule.
 *
 * A palette that lists orders and opens the one you pick IS cherry-picking,
 * reached by keyboard. Refused rather than approximated, and the palette states
 * the refusal on screen instead of silently offering nine of ten things.
 *
 * The screen list comes from the SERVER's permission projection, so the palette
 * cannot open a world the rail refuses to draw — INVARIANTS 42/43 reach the
 * keyboard too, and they reach it through the same payload rather than through
 * a second copy of the rule.
 */
export interface Command {
  readonly id: string;
  readonly label: string;
  readonly group: "Screens" | "Actions";
  readonly run: () => void;
}

export function useCommands(
  rules: readonly GrantedPermissionSchema[] | undefined,
): readonly Command[] {
  const navigate = useNavigate();
  const close = useOverlays((s) => s.close);
  const signOut = useSignedIn((s) => s.signOut);

  return useMemo(() => {
    const screens: Command[] = DOORS.filter((door) => hasDoor(rules, door.path)).map(
      (door) => ({
        id: `screen:${door.path}`,
        label: door.label,
        group: "Screens",
        run: () => {
          close("palette");
          void navigate({ to: door.path });
        },
      }),
    );

    /*
     * "Switch user" and "Sign out" are the same client-side act — there is no
     * auth surface in the contract (see `app/session/signedIn.ts`) — so only
     * one is offered here rather than two entries that do one thing. The rail's
     * profile block draws both because the design draws both there.
     */
    const actions: Command[] = [
      {
        id: "action:sign-out",
        label: "Sign out",
        group: "Actions",
        run: () => {
          close("palette");
          signOut();
        },
      },
    ];

    return [...screens, ...actions];
  }, [rules, close, navigate, signOut]);
}
