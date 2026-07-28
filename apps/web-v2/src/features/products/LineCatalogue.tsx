import { useState } from "react";

import { Button } from "../../shared/ui/Button";
import { Eyebrow } from "../../shared/ui/Eyebrow";

import { EmptyState } from "./EmptyState";
import { LineCard } from "./LineCard";
import { SIGNOFF_LINES } from "./lines";

/**
 * The line catalogue — one vocabulary, shared by every product and client.
 *
 * The screen says out loud that a NEW LINE LANDS AS NOT APPLICABLE EVERYWHERE.
 * That default is the safety property of this whole layer: adding a line cannot
 * silently start demanding an answer on every order in every product. It is
 * inert until a product opts in from the baseline grid, so authoring a line and
 * changing what a search must satisfy stay two separate, deliberate acts.
 *
 * Retired lines are FILTERED, not deleted, and the filter defaults to hiding
 * them — a retired line still has to exist, because orders answered against it
 * still reference it.
 */
export function LineCatalogue({
  canAuthor,
  onNew,
  onEdit,
}: {
  canAuthor: boolean;
  onNew: () => void;
  onEdit: () => void;
}) {
  const [showRetired, setShowRetired] = useState(false);
  const lines = showRetired ? SIGNOFF_LINES : SIGNOFF_LINES.filter((l) => !l.retired);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-5">
        <Eyebrow variant="section" as="h2">Sign-off lines</Eyebrow>
        <Button
          size="sm"
          fill="outlined"
          tone="neutral"
          data-testid="toggle-retired-lines"
          onClick={() => setShowRetired((v) => !v)}
        >
          {showRetired ? "Hide retired" : "Show retired"}
        </Button>
        {canAuthor ? (
          <Button className="ml-auto" data-testid="new-line" onClick={onNew}>
            ＋ New line
          </Button>
        ) : null}
      </div>

      <p className="text-xs leading-body text-ink-muted">
        The vocabulary every product and client draws from. A new line lands in
        the grid as <span className="font-semibold">not applicable everywhere</span>{" "}
        — inert until a product opts in.
      </p>

      {lines.length === 0 ? (
        <EmptyState
          title="No lines yet"
          body="Start from the standard 13 as a starting point, or write your own."
        >
          {/* CONTRACT GAP: seeding the standard 13 is a server write with no endpoint. */}
          <Button size="lg" fill="tinted" tone="action" disabled>
            Start from the standard 13
          </Button>
          <Button size="lg" onClick={onNew}>＋ Write a line</Button>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {lines.map((line) => (
            <LineCard key={line.id} line={line} canAuthor={canAuthor} onEdit={onEdit} />
          ))}
        </div>
      )}

      <p className="text-xs leading-body text-ink-muted">
        CONTRACT GAP: no sign-off-line endpoint exists. The catalogue is a
        fixture; editing opens the drawer but cannot save, and no line here has
        ever been versioned by a server.
      </p>
    </section>
  );
}
