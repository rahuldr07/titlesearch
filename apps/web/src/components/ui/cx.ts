/**
 * clsx resolves conditionals; tailwind-merge resolves conflicts. Stock
 * tailwind-merge only knows Tailwind's stock scales, so it reads a custom
 * size like `text-body` as a text colour, puts it in the same conflict group
 * as `text-ink-on-action`, and silently deletes whichever came first. The
 * custom scales are therefore declared below — this list must stay in sync
 * with tokens.css.
 */
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      // Font sizes, not colours.
      text: ["label", "meta", "body", "subject", "title", "verdict"],
      // The token file's radii, including the two Tailwind lacks.
      radius: ["pill", "paper"],
      leading: ["flat", "close", "body", "open", "airy", "document", "scan"],
    },
  },
});

export function cx(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
