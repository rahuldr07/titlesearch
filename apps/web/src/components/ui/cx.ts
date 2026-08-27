/**
 * Class merging, and the reason it is not one line.
 *
 * `clsx` resolves conditionals; `tailwind-merge` resolves CONFLICTS — a caller
 * passing `px-8` to a component whose base is `px-6` must win, and without a
 * merge the two both land and the cascade decides by source order, which is
 * whatever the build emitted that day.
 *
 * ══ WHY THE SCALE HAS TO BE DECLARED, MEASURED RATHER THAN ASSUMED ══════════
 *
 * `twMerge` out of the box knows Tailwind's STOCK scales. Rule 2 deleted the
 * numeric `--text-*` family and replaced it with six semantic names, and stock
 * tailwind-merge has never heard of `text-body`. It therefore falls back to
 * reading `text-body` as a TEXT COLOUR, which puts it in the same conflict
 * group as `text-ink-on-action` — and the later one wins.
 *
 * That is not theoretical. The Button `lg` story failed axe with "insufficient
 * color contrast of 2.42 (foreground #14161c, background #5b4b8a)": the accent
 * fill was still there, `text-ink-on-action` had been silently deleted by the
 * merge, and the label fell back to inherited ink on violet. A white-on-violet
 * button rendered near-black on violet, with a green typecheck and a green
 * lint.
 *
 * So the six type sizes and the two custom radii are declared here. Every
 * `--text-*` in the token file is listed; if rule 2 ever gains a seventh size,
 * this list is the second place that has to change, and the first is
 * `tokens.css` itself.
 */
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      // Rule 2: SIX sizes. These are font sizes, not colours.
      text: ["label", "meta", "body", "subject", "title", "verdict"],
      // Rule 5: the token file's radii, including the two Tailwind lacks.
      radius: ["pill", "paper"],
      // Rule 10: the three timings. Named so `tp-state` and friends compose.
      leading: ["flat", "close", "body", "open", "airy", "document", "scan"],
    },
  },
});

export function cx(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
