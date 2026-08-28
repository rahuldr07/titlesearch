import { useMemo } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
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

const ORDER_PATH = /^\/orders\/([^/]+)/;

export function useCommands(
  rules: readonly GrantedPermissionSchema[] | undefined,
): readonly Command[] {
  const navigate = useNavigate();
  const close = useOverlays((s) => s.close);
  const open = useOverlays((s) => s.open);
  const signOut = useSignedIn((s) => s.signOut);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hasOrder = ORDER_PATH.test(pathname);

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
     * The three cross-cutting overlays are reachable from here and nowhere
     * else in the keyboard layer, because only `?` has a key the design gives
     * it. Inventing chords for the other two would put keys in the shortcut
     * list that the design never asked for.
     *
     * "Order history" is offered ONLY when an order is in the URL. It is not
     * disabled-but-visible: a command that cannot run is rule 9's boolean
     * disabled wearing a palette row, and there is no order to name.
     */
    const actions: Command[] = [
      {
        id: "action:shortcuts",
        label: "Keyboard shortcuts",
        group: "Actions",
        run: () => {
          close("palette");
          open("key-map");
        },
      },
      {
        id: "action:na-guide",
        label: "No-value states",
        group: "Actions",
        run: () => {
          close("palette");
          open("na-guide");
        },
      },
      ...(hasOrder
        ? [
            {
              id: "action:order-history",
              label: "Order history",
              group: "Actions" as const,
              run: () => {
                close("palette");
                open("order-history");
              },
            },
          ]
        : []),
      /*
       * "Switch user" and "Sign out" are the same client-side act — there is no
       * auth surface in the contract (see `app/session/signedIn.ts`) — so only
       * one is offered here rather than two entries that do one thing. The
       * rail's profile block draws both because the design draws both there.
       */
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
  }, [rules, close, open, navigate, signOut, hasOrder]);
}
