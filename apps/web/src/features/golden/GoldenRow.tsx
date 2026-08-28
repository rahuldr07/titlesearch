import type { GoldenField } from "@titlepipe/contract";
import { Button } from "../../components/ui";
import { SeedValue } from "./SeedValue";
import { SeedTagCaveat, SeedTagMark } from "./SeedTag";
import { SeedAct } from "./SeedAct";

/**
 * ONE FIELD OF THE RULER, AND EVERYTHING THAT HAPPENED TO IT.
 *
 * Per-row facts only. There is no score on this row, no pass/fail, no
 * agreement percentage — AGENTS.md bans an aggregate accuracy headline and the
 * ban does not become legal by being computed one row at a time. What a row
 * carries is what the corpus records: where the value came from (the tag),
 * whether it can be cited, and — if a person has already ruled on it — who,
 * when, from what, and why.
 *
 * ══ THE CORRECTION HISTORY IS THE POINT ════════════════════════════════════
 *
 * `corrected_from` survives forever (`handlers.ts:1348`). A ruler whose
 * graduations were moved without a visible record of the move is a ruler nobody
 * can audit, so the PRIOR value is printed beside the current one rather than
 * replaced by it. `gf_2` in the live payload is the shape: value `Lis Pendens`,
 * corrected_from `Judgment`, signed `M. Estrada`, with the reason on the
 * record.
 *
 * ══ THE ACT DOOR IS ABSENT WITHOUT THE GRANT ═══════════════════════════════
 *
 * `INVARIANTS:42-43` — a role-locked affordance is ABSENT, not disabled, and
 * `GET /api/me/permissions` returns THIS role's projection, so a reader without
 * `golden.confirm` never received a grant to withhold. `mayAct` is that lookup,
 * done once on the screen. Rule 9/12's disabled-with-a-reason still governs the
 * other kind of block — already resolved — because that is resource state, not
 * authorization: what you may never do is absent, what you cannot do yet says
 * why.
 */
export function GoldenRow(props: {
  readonly seed: GoldenField;
  readonly mayAct: boolean;
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
}) {
  const resolved = props.seed.corrected_at;

  return (
    <li
      data-testid="golden-row"
      data-seed-id={props.seed.id}
      className="flex flex-col gap-6 border-b border-line-subtle px-12 py-10 last:border-b-0"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-6">
        <div className="flex min-w-0 flex-wrap items-baseline gap-6">
          {/* Rule 3: a field path is an identifier, and it is the SAME string
              the rulebook and the bench spell — never recased for decoration. */}
          <span className="font-mono text-meta leading-close font-semibold text-ink-secondary">
            {props.seed.path}
          </span>
          <span className="font-mono text-label leading-flat text-ink-faint">
            {props.seed.order_id}
          </span>
        </div>
        <SeedTagMark tag={props.seed.tag} />
      </div>

      <SeedValue seed={props.seed} />
      <SeedTagCaveat tag={props.seed.tag} />

      {resolved !== null && (
        <div className="flex flex-col gap-3 border-t border-line-faint pt-6">
          <span className="font-sans text-label leading-flat font-bold text-ink-faint">
            On the permanent record
          </span>
          <p className="font-sans text-meta leading-body text-ink-secondary">
            Signed{" "}
            <span className="font-mono">
              {props.seed.corrected_by ?? "an unnamed actor"}
            </span>{" "}
            at <span className="font-mono">{resolved}</span>
            {props.seed.corrected_from !== null && (
              <>
                {" · was "}
                <span className="font-mono">{props.seed.corrected_from}</span>
              </>
            )}
          </p>
          {props.seed.correction_reason !== null && (
            <p className="font-sans text-meta leading-body text-ink-primary">
              {props.seed.correction_reason}
            </p>
          )}
        </div>
      )}

      {props.mayAct &&
        (props.open ? (
          <SeedAct seed={props.seed} onFiled={props.onClose} />
        ) : (
          <div>
            <Button
              data-testid="golden-act-open"
              variant="secondary"
              disabledBecause={
                resolved === null
                  ? null
                  : `Already resolved — signed by ${props.seed.corrected_by ?? "an unnamed actor"}. A seed act is permanent and files once.`
              }
              onPress={props.onOpen}
            >
              Confirm or demote this seed
            </Button>
          </div>
        ))}
    </li>
  );
}
