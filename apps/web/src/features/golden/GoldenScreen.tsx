import { useState } from "react";
import { useRead } from "../../app/useRead";
import { goldenSet } from "../../shared/goldenQueries";
import { hasAction, usePermissions } from "../../app/session/permissions";
import { useSignedIn } from "../../app/session/signedIn";
import { Alert, Card, Empty } from "../../components/ui";
import { GoldenRow } from "./GoldenRow";
import { GoldenPreamble } from "./GoldenPreamble";

/**
 * SCREEN — THE GOLDEN SET, at `/golden` (`authz.ts:72`, `screen.golden.enter`,
 * engineer/admin).
 *
 * THE DESIGN DOES NOT DRAW THIS SCREEN. `unbuiltScreens.ts:78-82` records why
 * that matters: "the ground-truth corpus is invisible in it, and this is the
 * one screen where ground truth changes." So the layout is built to the design
 * SYSTEM rather than transcribed — a screen body that scrolls inside the one
 * frame (`INVARIANTS:60`), a header, and one card of rows.
 *
 * ══ THERE IS NO NUMBER AT THE TOP OF THIS SCREEN ═══════════════════════════
 *
 * AGENTS.md's anti-pattern list: "no aggregate accuracy headline". The contract
 * enforces the same refusal structurally one screen over —
 * `endpoints.ts:336-339` says the bench shape carries "deliberately NO
 * aggregate number", and `handlers.ts:1092` repeats it. This screen holds the
 * strongest temptation in the product: four rows, three of them settled, and a
 * "75% verified" would fall out of a single `.filter().length`. It is absent,
 * and `GoldenPreamble` says in words why — a corpus anchored on typist
 * behaviour cannot be summarised into a number that means what a reader would
 * take it to mean.
 *
 * Nor is there a row count headline, a coverage bar, a pass rate, or a probe
 * figure. `/api/metrics` is not read here at all: probe visibility is a banned
 * anti-pattern, and a screen about the ruler is exactly where somebody would
 * put `catch_rate` and call it validation.
 *
 * ══ ONE OPEN DECISION AT A TIME ════════════════════════════════════════════
 *
 * Rule 1 spends the accent once per view, and `openSeedId` is what makes that
 * true of a list: at most one row draws the accent rail and the primary button.
 * It is component state rather than a URL key because this screen owns no
 * search params — the route is wired without them — and a half-typed reason is
 * not a thing to make bookmarkable.
 *
 * ══ BOTH GRANTS, OR NEITHER ════════════════════════════════════════════════
 *
 * `authz.ts:108-109` grants `golden.confirm` and `golden.demote` to the same
 * three roles, and the act form offers both arms in one radio. Gating on both
 * means a reader is never shown an arm the server would 403 — and if the two
 * grants ever diverge, this renders nothing rather than something broken.
 */
export function GoldenScreen() {
  const corpus = useRead(goldenSet);
  const permissions = usePermissions(useSignedIn((state) => state.account !== null));
  const [openSeedId, setOpenSeedId] = useState<string | null>(null);

  const mayAct =
    hasAction(permissions.data?.rules, "golden.confirm") &&
    hasAction(permissions.data?.rules, "golden.demote");

  return (
    <div
      data-testid="golden-screen"
      className="flex h-full min-h-0 flex-col gap-12 overflow-y-auto p-14"
    >
      <GoldenPreamble />

      {corpus.isError ? (
        /* INVARIANTS:58 — a failed list query renders a NAMED unavailable
           state, and the reason is the server's sentence, never ours. */
        <Alert
          tone="halt"
          title="The golden set is unavailable"
          message={corpus.error?.message ?? "The corpus did not load."}
        />
      ) : corpus.isPending || corpus.data === undefined ? (
        <Card>
          <p className="font-sans text-meta leading-body text-ink-muted">
            Reading the golden set…
          </p>
        </Card>
      ) : corpus.data.golden_fields.length === 0 ? (
        <Card>
          <Empty
            title="No seeded fields"
            reason="The corpus is empty. That is not a clean bench — it is a bench with nothing on it, and nothing can be scored against it until a seed is filed."
          />
        </Card>
      ) : (
        <Card padding="none">
          <ul data-testid="golden-rows">
            {corpus.data.golden_fields.map((seed) => (
              <GoldenRow
                key={seed.id}
                seed={seed}
                mayAct={mayAct}
                open={openSeedId === seed.id}
                onOpen={() => setOpenSeedId(seed.id)}
                onClose={() => setOpenSeedId(null)}
              />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
