import { Link } from "@tanstack/react-router";
import { Eyebrow } from "../shared/ui/Eyebrow";

/** The wordmark `AppChrome` hands the rail as its `brand` slot. Split out to keep `AppChrome` under the line budget (§6). */
export function SidebarBrand() {
  return (
    <Link to="/" className="flex min-w-0 items-center gap-3 no-underline">
      <span aria-hidden className="flex size-8 shrink-0 flex-col justify-center gap-1 rounded-2 border-2 border-action px-1">
        <span className="h-0.5 rounded-pill bg-action" />
        <span className="h-0.5 w-3/4 rounded-pill bg-action" />
        <span className="h-0.5 rounded-pill bg-action" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold tracking-stamp text-ink-primary">TITLEPIPE</span>
        <Eyebrow variant="caption">Abstractor Review</Eyebrow>
      </span>
    </Link>
  );
}
