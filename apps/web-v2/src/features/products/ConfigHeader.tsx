import { ScreenTitle } from "../../app/ScreenTitle";
import { Chip } from "../../shared/ui/Chip";

import { CONFIG_VERSION } from "./catalogue";

/**
 * The header states the ONE thing that stops this screen being dangerous: what
 * an edit here does, and when.
 *
 * Two different kinds of write live behind the same tabs. A record (a product,
 * a client) is created directly and nothing downstream moves. Behaviour config
 * — line wording, baseline cells, client overrides — publishes a NEW CONFIG
 * VERSION, and an order already in flight keeps the version it was stamped
 * with. Without that sentence in front of the tabs, "save" reads as "change
 * every open order", which is the one thing it must never mean.
 *
 * The version chip is therefore not decoration: it is the identifier the order
 * carries. It sits at the top right, read-only, with "applies to new orders
 * only" under it, because the number is only meaningful next to that clause.
 */
export function ConfigHeader({ canAuthor }: { canAuthor: boolean }) {
  return (
    <header className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-8">
        <div className="min-w-130 flex-1">
          <ScreenTitle>Admin · Products &amp; sign-off</ScreenTitle>
          <h1 className="mt-4 text-3xl font-semibold text-ink-primary">Configuration</h1>
          <p className="mt-2 max-w-prose text-base leading-body text-ink-secondary">
            Editable without a release. Records (products, clients) create
            directly; behaviour config (line wording, baseline cells, overrides)
            publishes a new config version on save. Nothing is deleted — things
            retire. Never reaches an order already in flight.
          </p>
        </div>
        <div className="text-right">
          <Chip tone="action" size="md" shape="mono" bordered className="normal-case">
            {CONFIG_VERSION}
          </Chip>
          <p className="mt-2 text-tiny text-ink-muted">
            current · applies to new orders only
          </p>
        </div>
      </div>

      {/*
        The banner is a COURTESY, never the control. The server refuses an
        unauthorised write on its own; this only explains why the authoring
        controls are absent, so a reviewer does not read a missing button as a
        broken screen.
      */}
      {canAuthor ? null : (
        <p
          data-testid="config-read-only"
          className="rounded-7 border border-state-attend-border bg-state-attend-surface px-7 py-5 text-xs leading-body text-state-attend-ink"
        >
          Viewing only. Authoring is limited to admin and engineer — the server
          enforces this independently. Switch role via the account menu to
          preview editing.
        </p>
      )}
    </header>
  );
}
