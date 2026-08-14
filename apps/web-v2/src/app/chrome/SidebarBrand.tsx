import { Link } from "@tanstack/react-router";
import { Wordmark } from "../../shared/ui/Wordmark";

/**
 * The wordmark `AppChrome` hands the rail as its `brand` slot — the shared
 * `Wordmark` at rail size, wrapped in the hub link.
 *
 * THE LINK IS THE ONLY THING THIS ADDS, and that is the point of the split: the
 * mark itself is drawn once, in `shared/ui`, and sign-in renders the same object
 * without an anchor around it. This file used to draw its own three-bar glyph
 * and its own `TITLEPIPE` caps beside a duplicate of sign-in's — two copies of
 * one identity, already divergent in size, weight and sub-line.
 *
 * The `ABSTRACTOR REVIEW` caption went with them. It was a second line under the
 * product name in a 264px column that has four section headers below it; the
 * mockup's rail names the product once and spends the rest of the space on
 * navigation.
 */
export function SidebarBrand() {
  return (
    <Link to="/" className="min-w-0 no-underline">
      {/*
        `inverted` BECAUSE OF THE GROUND, not the theme. This is the one place
        the mark stands on the dark rail; sign-in draws the same object on a
        light card and passes nothing. Without it the default tokens apply and
        the mark measures 1.00:1 on `--color-rail-surface` — not faint, gone.
      */}
      <Wordmark size="rail" inverted />
    </Link>
  );
}
