import { useMemo } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { GrantedPermissionSchema } from "@titlepipe/contract";
import { DOORS } from "../chrome/doors";
import { hasDoor } from "../session/permissions";
import { useOverlays } from "./overlays";
import { useSignedIn } from "../session/signedIn";

/**
 * What the palette can do — the screens this reader may open, and the acts.
 * The screen list comes from the server's permission projection, so the
 * palette cannot open a world the rail refuses to draw. The orders half of
 * the palette lives in `PaletteBody.tsx`, where the read belongs. `hint` is
 * UI prose about a screen, never a fact about an order — those come off the
 * wire.
 */
export interface PaletteEntry {
  readonly id: string;
  readonly label: string;
  /** The design's second line: what the row leads to. */
  readonly hint: string;
  readonly group: "Screens" | "Orders" | "Actions";
  readonly run: () => void;
}

const ORDER_PATH = /^\/orders\/([^/]+)/;

/** The design's per-screen gloss, keyed by door path. Prose, not wire data. */
const SCREEN_HINT: Readonly<Record<string, string>> = {
  "/": "Pipeline stages and what is waiting on you",
  "/orders-list": "Every order — search, filter and pages",
  "/orders": "This order's hub: stages, gaps and history",
  "/ingest": "Drop a package and record the sign-off",
  "/delivery": "Released reports and their artifacts",
  "/escalations": "Queries waiting on a QC or legal ruling",
  "/templates": "Report blocks, samples and the compiled spec",
  "/account": "People, permissions and the rule catalogue",
  "/blind": "Typist capture — no rail, no stage, no palette",
  "/jurisdiction": "County rules and what each one requires",
};

export function useCommands(
  rules: readonly GrantedPermissionSchema[] | undefined,
): readonly PaletteEntry[] {
  const navigate = useNavigate();
  const close = useOverlays((s) => s.close);
  const open = useOverlays((s) => s.open);
  const signOut = useSignedIn((s) => s.signOut);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hasOrder = ORDER_PATH.test(pathname);

  return useMemo(() => {
    const screens: PaletteEntry[] = DOORS.filter((door) =>
      hasDoor(rules, door.path),
    ).map((door) => ({
      id: `screen:${door.path}`,
      label: door.label,
      hint: SCREEN_HINT[door.path] ?? "",
      group: "Screens",
      run: () => {
        close("palette");
        void navigate({ to: door.path });
      },
    }));

    /*
     * The three cross-cutting overlays are reachable from here; only `?` has
     * a key of its own, and inventing chords for the other two would put
     * keys in the shortcut list nobody asked for. "Order history" is offered
     * only when an order is in the URL — not disabled-but-visible, because
     * there is no order to name.
     */
    const actions: PaletteEntry[] = [
      {
        id: "action:shortcuts",
        label: "Keyboard shortcuts",
        hint: "Every key this app installs, and where it fires",
        group: "Actions",
        run: () => {
          close("palette");
          open("key-map");
        },
      },
      {
        id: "action:na-guide",
        label: "No-value states",
        hint: "The four NA reasons, and the one that is not an NA state",
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
              hint: "This order's thread through the pipeline",
              group: "Actions" as const,
              run: () => {
                close("palette");
                open("order-history");
              },
            },
          ]
        : []),
      /*
       * "Switch user" and "Sign out" are the same client-side act — there is
       * no auth surface in the contract — so only one is offered here.
       */
      {
        id: "action:sign-out",
        label: "Sign out",
        hint: "End this session and return to the sign-in screen",
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
