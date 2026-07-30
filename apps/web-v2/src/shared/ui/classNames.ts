import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes, last-wins on conflicts.
 *
 * `clsx` resolves conditionals; tailwind-merge resolves *conflicts* — without
 * it `cn("p-4", "p-8")` emits both and the winner depends on stylesheet order
 * rather than call order, so a variant override becomes unreliable.
 *
 * THE THEME EXTENSION IS NOT OPTIONAL. tailwind-merge classifies a class by
 * matching its value against known scales, and our scales are custom, so out of
 * the box it guesses wrong in both directions. Measured before this config:
 *
 *   text-micro text-ink-muted   ->  text-ink-muted        FONT SIZE SILENTLY DROPPED
 *   text-micro text-xs          ->  both kept             two font sizes emitted
 *   rounded-3 rounded-pill      ->  both kept             two radii emitted
 *   tracking-badge tracking-label -> both kept            two trackings emitted
 *
 * The first is the dangerous one: every Eyebrow pairs a size token with a
 * colour token, so unconfigured tailwind-merge would strip the size from the
 * design's most repeated element and nothing would fail — it would just render
 * at the inherited size.
 *
 * Registering the size-like scales is what lets it tell `text-micro` (a size)
 * from `text-ink-muted` (a colour). Colours need no entry: unknown `text-*`
 * already falls through to text-colour, which is correct.
 *
 * Any new size/radius/tracking/leading/shadow token must be added here too, or
 * it silently rejoins the guessing.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "micro", "tiny", "xs", "sm", "base", "md",
        "lg", "census", "xl", "2xl", "3xl", "4xl", "5xl",
      ],
      radius: [
        "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
        "xs", "sm", "md", "lg", "xl", "pill",
      ],
      tracking: ["eyebrow", "badge", "stamp", "label"],
      leading: ["flat", "tight", "close", "body", "open", "airy", "document", "scan"],
      font: ["sans", "mono", "quote"],
      shadow: [
        "page", "page-on-dark", "menu", "drawer",
        "scrim", "card", "pop", "knob",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
