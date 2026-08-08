import { useCallback, useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useHotkeys } from "react-hotkeys-hook";
import { doorsFor, doorForKey } from "../../entities/nav/doors";
import { useSession } from "../../shared/session";
import { useKeyboardLayer } from "../../shared/keyboard";
import { useNavCollapsed } from "../preferences";
import { KeyMap } from "./KeyMap";

/**
 * Keyboard as navigation: `g` then a door key, and `?` for the map.
 *
 * A CHORD'S SECOND KEY MUST NOT ALSO FIRE A SCREEN ACTION — `navigation.spec`
 * #2 pins this, and it is the bug that makes keyboard-first unusable: pressing
 * `g` then `e` on the review screen must go to escalations, not open the
 * escalate input. So an armed chord swallows the next key, whatever it is.
 *
 * A ROLE CANNOT CHORD OUTSIDE ITS WORLD. `doorForKey` returns null and nothing
 * happens — the same table that hides the door refuses the shortcut, so there
 * is no back way in. The four harvested world-boundary tests (`roles.spec`) ARE
 * NOT BUILT as a spec file; `authz.test.ts` proves the table they read, and
 * `sidebar.spec` #2 proves a door outside the role's world is absent.
 *
 * Hotkeys do not fire inside inputs by default, which is what stops a chord
 * key typed into a correction from navigating (`hard.spec` #5).
 */
export function GlobalKeys() {
  const navigate = useNavigate();
  const role = useSession((s) => s.role);
  /*
   * Chord and map state live in the shared keyboard layer rather than here, so
   * the screen underneath can stand its own hotkeys down while either is up.
   * Same rule twice: a key belongs to exactly one layer at a time.
   */
  const armed = useKeyboardLayer((s) => s.armed);
  const mapOpen = useKeyboardLayer((s) => s.mapOpen);
  const setArmed = useKeyboardLayer((s) => s.setArmed);
  const setMapOpen = useKeyboardLayer((s) => s.setMapOpen);

  /*
   * THE GLOBAL KEY LAYER IS DEAD ON THE CAPTURE SEAT: `?` shows no map and
   * `g q` does not navigate. Structural blindness includes the keyboard — a
   * chord out of the seat is a door out of it, and the map names worlds a
   * typist must not be shown. The harvested `blind-blindness.spec` #2 that
   * would assert it IS NOT BUILT; what holds is the `onCaptureSeat` guard on
   * every binding below, which is why it is repeated rather than centralised.
   */
  const onCaptureSeat = useRouterState({
    select: (s) => s.location.pathname.startsWith("/blind"),
  });

  const [, toggleNav] = useNavCollapsed(!onCaptureSeat);
  const doors = doorsFor(role);

  const openDoor = useCallback(
    (key: string) => {
      const door = doorForKey(role, key);
      if (door) void navigate({ to: door.path });
    },
    [role, navigate],
  );

  useHotkeys("g", () => setArmed(true), { enabled: !onCaptureSeat, preventDefault: true }, [onCaptureSeat]);

  // Every letter, so an armed chord consumes the second key rather than
  // letting it fall through to a screen hotkey.
  useHotkeys(
    "a,b,c,d,e,f,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z",
    (event, handler) => {
      if (!armed) return;
      event.preventDefault();
      setArmed(false);
      openDoor(handler.keys?.[0] ?? "");
    },
    { enabled: armed && !onCaptureSeat, preventDefault: false },
    [armed, openDoor],
  );

  /*
   * `?` is matched on the CHARACTER, not as a hotkey name — react-hotkeys-hook
   * does not recognise "?" as a key, and "shift+slash" only matches the
   * physical chord, so a synthetic keypress never opened the map. That is the
   * worst failure mode available: a real affordance with no proof it works.
   *
   * The input guard is kept by hand here because this bypasses the library's:
   * typing "?" into a correction must not open a modal over the evidence.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "?" || onCaptureSeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      setMapOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCaptureSeat, setMapOpen]);
  /*
   * `[` folds the navigator, matched on the CHARACTER for the same reason `?`
   * is: react-hotkeys-hook does not recognise bracket keys as hotkey names, so
   * the binding registered and never fired — an affordance with no proof it
   * works, which is the worst kind.
   *
   * The input guard is by hand because this bypasses the library's. A bracket
   * typed into a correction is a bracket (`sidebar.spec` #5): a layout change
   * behind the cursor while somebody is writing a reason is unforgivable.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "[" || onCaptureSeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      toggleNav();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCaptureSeat, toggleNav]);

  useHotkeys("escape", () => { setMapOpen(false); setArmed(false); }, { enabled: mapOpen || armed }, [mapOpen, armed]);

  if (!mapOpen) return null;
  return <KeyMap doors={doors} />;
}
