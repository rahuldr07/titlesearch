import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Eyebrow } from "../shared/ui/Eyebrow";

/**
 * A MOUSE USER IS NEVER STRANDED (`ux.spec` #7).
 *
 * Every screen's title is its path back to the hub. This used to be the side
 * rail's job; commit c2e9011 deleted the rail, and the rule did not go with it
 * — keyboard-first is a preference, not a prerequisite, and a screen you can
 * only leave by chord is a screen half the people using it cannot leave.
 *
 * The title is the right carrier because it is the one element every screen
 * already has, in the one place people already look. Adding a separate "back"
 * control would be a second thing to maintain and a second thing to forget.
 */
export function ScreenTitle({ children }: { children: ReactNode }) {
  return (
    <Link to="/" data-testid="screen-title" className="w-fit">
      <Eyebrow variant="screen">{children}</Eyebrow>
    </Link>
  );
}
