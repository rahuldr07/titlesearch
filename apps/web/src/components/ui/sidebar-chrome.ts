import { cx } from "./cx";

/**
 * A door: 38px tall, radius 14, accent fill when active. The active fill
 * does not count against the once-per-screen accent budget — the rail is
 * chrome beside every screen, and "you are here" is not a decision.
 *
 * The kit owns how a door LOOKS, never where it goes. The routed component
 * is `app/chrome/SidebarMenuLink`, which is the same split as `LinkButton`
 * (plain `href`) against `RouteButton` (typed against the route tree): a
 * design system that imports the app's route tree is not a design system,
 * and it is the reason this file used to fail `presentational-fetches`
 * silently — the rule did not scan `components/` until 2026-09-04.
 */
export function sidebarDoorClass(active: boolean) {
  return cx(
    "tp-state tp-press flex h-19 w-full items-center gap-4 overflow-hidden rounded-lg px-6",
    "text-meta leading-flat",
    active
      ? "bg-action font-semibold text-ink-on-action"
      : // Resting is 400 and active is 600, so weight carries the "you are
        // here" signal alongside the fill.
        "font-normal text-rail-ink hover:bg-rail-line",
  );
}
