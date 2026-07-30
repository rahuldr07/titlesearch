import type { ConfigLine } from "@titlepipe/contract";
import { useState } from "react";

import { Button } from "../../shared/ui/Button";
import { EmptyPanel } from "../../shared/ui/EmptyPanel";
import { Eyebrow } from "../../shared/ui/Eyebrow";

import { LineCard } from "./LineCard";

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
  lines,
  canAuthor,
  onNew,
  onEdit,
}: {
  lines: readonly ConfigLine[];
  canAuthor: boolean;
  onNew: () => void;
  onEdit: () => void;
}) {
  const [showRetired, setShowRetired] = useState(false);
  const shown = showRetired ? lines : lines.filter((l) => !l.retired);

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
          /* Section-level, so `sm` — the same ladder `ProductList` explains. */
          <Button size="sm" className="ml-auto" data-testid="new-line" onClick={onNew}>
            ＋ New line
          </Button>
        ) : null}
      </div>

      <p className="text-xs leading-body text-ink-muted">
        The vocabulary every product and client draws from. A new line lands in
        the grid as <span className="font-semibold">not applicable everywhere</span>{" "}
        — inert until a product opts in.
      </p>

      {/*
        RESOLVED AND EMPTY, WITH A CAVEAT WORTH NAMING: this branch is also
        reached when every line is retired and the filter is hiding them. Both
        are "the server answered and there is nothing to show under what you
        asked for" — which is the panel's meaning — and neither is "not
        loaded", which stays `ScreenMessage`'s job upstream.

        TWO ACTIONS, WHICH IS WHY THEY ARE A PROP AND NOT A FIXED BUTTON. The
        products panel offers one way in; this one offers a seed and a blank
        page, and that choice is the panel's content rather than its trim.
      */}
      {shown.length === 0 ? (
        <EmptyPanel
          title="No lines yet"
          body="Start from the standard 13 as a starting point, or write your own."
          actions={
            <>
              {/* CONTRACT GAP: seeding the standard 13 is a server write with no endpoint. */}
              <Button size="lg" fill="tinted" tone="action" disabled>
                Start from the standard 13
              </Button>
              <Button size="lg" onClick={onNew}>＋ Write a line</Button>
            </>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {shown.map((line) => (
            <LineCard key={line.id} line={line} canAuthor={canAuthor} onEdit={onEdit} />
          ))}
        </div>
      )}

      <p className="text-xs leading-body text-ink-muted">
        CONTRACT GAP: the sign-off-line endpoint is READ ONLY. The catalogue is
        the server's, but editing opens a drawer that cannot save and no version
        here can be minted from this screen.
      </p>
    </section>
  );
}
