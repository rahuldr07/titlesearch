import { useState } from "react";
import { useRead } from "../../app/useRead";
import { goldenSet } from "../../shared/goldenQueries";
import { hasAction, usePermissions } from "../../app/session/permissions";
import { useSignedIn } from "../../app/session/signedIn";
import { Alert, Card, ComboBox, Empty, Option } from "../../components/ui";
import { CorrectionPreamble } from "./CorrectionPreamble";
import { CurrentSeed } from "./CurrentSeed";
import { CorrectionForm } from "./CorrectionForm";
import { RelatedDoor } from "../../app/chrome/RelatedDoor";

/**
 * SCREEN — SEED CORRECTION, at `/seed-correction` (`authz.ts`,
 * `screen.seed-correction.enter`).
 *
 * The design does not draw it (`unbuiltScreens.ts:84-89`), so the shell is
 * built to the system: one frame, one scrolling body (`INVARIANTS:60`), a
 * header that argues, a chooser, the record as it stands, and the form.
 *
 * ══ THE CHOOSER IS A READ, NOT A WORK QUEUE ════════════════════════════════
 *
 * This looks like the affordance `INVARIANTS:22` refuses — "a single
 * server-chosen next order, no list, no browsing, no cherry-picking" — and it
 * is not. That rule governs WORK SELECTION: a reviewer must not pick which
 * order they take. The golden set is not work. It is the reference corpus a
 * correction is argued against, `GET /api/golden` returns it whole because it
 * is meant to be read whole, and nothing here claims, assigns or hands out
 * anything. `RulesPanel` records the same distinction for the rulebook:
 * choosing here changes what you READ, not what you may DO.
 *
 * ══ THE FORM IS ABSENT WITHOUT THE GRANT ═══════════════════════════════════
 *
 * `INVARIANTS:42-43` — a role-locked affordance is ABSENT, not disabled, and
 * `/api/me/permissions` returns this role's projection, so a reader without
 * `golden.correct` never received a grant to withhold. The record still
 * renders: reading the corpus and rewriting it are different permissions
 * (`authz.ts:106`), and a reader who may only read gets the record with no form
 * attached rather than a dimmed one.
 *
 * ══ THE FORM IS KEYED BY FIELD ═════════════════════════════════════════════
 *
 * `key={selected.id}` remounts it when the chosen row changes. That is not a
 * performance trick: two of its boxes are uncontrolled by construction
 * (`input.tsx:43`), so a remount is the only thing that clears them, and a
 * citation left over from the previous field would be filed against this one.
 */
export function SeedCorrectionScreen() {
  const corpus = useRead(goldenSet);
  const permissions = usePermissions(useSignedIn((state) => state.account !== null));
  const [seedId, setSeedId] = useState<string | null>(null);

  const rows = corpus.data?.golden_fields ?? [];
  const selected = rows.find((row) => row.id === seedId) ?? null;
  const mayCorrect = hasAction(permissions.data?.rules, "golden.correct");

  return (
    <div
      data-testid="seed-correction-screen"
      className="flex h-full min-h-0 flex-col gap-12 overflow-y-auto p-14"
    >
      <CorrectionPreamble />

      {corpus.isError ? (
        /* INVARIANTS:58 — a NAMED unavailable state, and the sentence is the
           server's. Without the corpus there is nothing to correct, so the
           form is not drawn against an empty list. */
        <Alert
          tone="halt"
          title="The golden set is unavailable"
          message={corpus.error?.message ?? "The corpus did not load."}
        />
      ) : corpus.isPending ? (
        <Card>
          <p className="font-sans text-meta leading-body text-ink-muted">
            Reading the golden set…
          </p>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <Empty
            title="No seeded fields"
            reason="The corpus is empty, so there is no ground truth to correct. A correction rewrites an existing row; it does not create one."
          />
        </Card>
      ) : (
        <div className="flex max-w-500 flex-col gap-12">
          <ComboBox
            label="The field of the corpus this correction rewrites"
            placeholder="Search the golden set by path or order…"
            selectedKey={seedId}
            onSelectionChange={(key) => setSeedId(key === null ? null : String(key))}
          >
            {rows.map((row) => (
              <Option key={row.id} id={row.id}>
                {`${row.path} — ${row.order_id}`}
              </Option>
            ))}
          </ComboBox>

          {selected === null ? (
            <Card>
              <p className="font-sans text-meta leading-body text-ink-secondary">
                Nothing chosen yet. Pick the field above and the record as it
                stands appears here, before anything is typed.
              </p>
            </Card>
          ) : (
            <>
              <CurrentSeed seed={selected} />
              {mayCorrect && (
                <CorrectionForm
                  key={selected.id}
                  seed={selected}
                  onFiled={() => setSeedId(null)}
                />
              )}
            </>
          )}
        </div>
      )}
      <RelatedDoor to="/golden">The golden set these corrections are measured against →</RelatedDoor>
    </div>
  );
}
