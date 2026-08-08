import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { canDo } from "@titlepipe/contract";
import { rulesQuery, useConfirmRule } from "./queries";
import { useSession } from "../../shared/session";
import { ApiError } from "../../shared/api";
import { EmptyNote } from "../../shared/ui/EmptyPanel";
import { Screen } from "../../shared/ui/Screen";
import { ScreenMessage } from "../../shared/ui/ScreenMessage";
import { RulebookHeader } from "./RulebookHeader";
import { RuleFilters, type RuleFilterKey } from "./RuleFilters";
import { RuleList } from "./RuleList";
import { RuleDetail } from "./RuleDetail";
import { NewRuleForm } from "./NewRuleForm";

/**
 * THE RULEBOOK — the whole book, not the account tab's summary of it.
 *
 * Two panes, and the split is the argument. The rail is the book: every rule,
 * live and pending and retired, in one list you can scan. The detail is one
 * rule with everything that stands between it and being applied. Making the
 * detail a page of its own would let someone confirm a rule without ever seeing
 * how many others are waiting behind it.
 *
 * SELECTION FALLS BACK TO THE FIRST VISIBLE RULE, never to nothing. An empty
 * right pane after a filter change reads as "no rule selected" when what
 * happened is "the rule you were reading is not in this filter" — and the
 * reader's own selection is the thing they lose track of first.
 *
 * THE DRAFT FORM REPLACES THE DETAIL, deliberately. Writing a new rule and
 * reading an existing one are different jobs, and showing both at once invites
 * copying an existing rule's citation into a new rule it does not support.
 *
 * CONTRACT GAP: `GET /api/rules` is the only rulebook read that exists. The
 * design's impact previews, version log, conflict counterparts and usage counts
 * have no endpoint and no field; each panel renders the design's figures and
 * says on screen that it is not wired.
 */
export function RulebookScreen() {
  const role = useSession((s) => s.role);
  const { data, isPending, isError } = useQuery(rulesQuery);
  const confirm = useConfirmRule();
  const [filter, setFilter] = useState<RuleFilterKey>("live");
  const [selected, setSelected] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);

  if (isError)
    return (
      <ScreenMessage tone="halt" measure="1160">
        Rulebook unavailable.
      </ScreenMessage>
    );
  if (isPending)
    return <ScreenMessage measure="1160">Loading the rulebook…</ScreenMessage>;

  const rules = data.rules;
  const visible = filter === "all" ? rules : rules.filter((r) => r.status === filter);
  const current = rules.find((r) => r.id === selected) ?? visible[0];

  const counts = {
    live: rules.filter((r) => r.status === "live").length,
    pending: rules.filter((r) => r.status === "pending").length,
    retired: rules.filter((r) => r.status === "retired").length,
  };

  return (
    <Screen measure="1160" pad="24x28">
      <div className="flex flex-col gap-7">
        <RulebookHeader counts={counts} onNewRule={() => setDrafting(true)} />

        <RuleFilters
          value={filter}
          counts={counts}
          total={rules.length}
          onChange={(next) => {
            setFilter(next);
            // Drop the stale selection so the fallback picks the first rule the
            // new filter actually shows.
            setSelected(null);
          }}
        />

        <div className="grid items-start gap-8 xl:grid-cols-[1fr_1.4fr]">
          <RuleList
            rules={visible}
            selected={current?.id ?? null}
            onSelect={(id) => {
              setSelected(id);
              setDrafting(false);
            }}
          />

          {drafting ? (
            <NewRuleForm onCancel={() => setDrafting(false)} />
          ) : current === undefined ? (
            /*
             * RESOLVED AND EMPTY, never *not loaded* — the two branches above
             * already returned for pending and error, so reaching here means
             * the server answered and this filter holds nothing. It is the
             * quiet register rather than a second dashed panel: the rail beside
             * it is already stating the same absence at panel weight, and two
             * panels saying one thing reads as two problems.
             */
            <EmptyNote>Nothing under this filter to read.</EmptyNote>
          ) : (
            <RuleDetail
              rule={current}
              mayConfirm={canDo(role, "rule.confirm", { status: current.status })}
              /*
               * The coarse role gate, with no resource: "is this an engineer or
               * an admin". Retiring and withdrawing are their acts too, and the
               * status-gated check above would refuse them on every non-pending
               * rule — which is every rule that can be retired.
               */
              mayAdminister={canDo(role, "rule.confirm")}
              confirmPending={confirm.isPending}
              confirmError={
                confirm.error instanceof ApiError ? confirm.error.message : null
              }
              onConfirm={() => confirm.mutate(current.id)}
            />
          )}
        </div>
      </div>
    </Screen>
  );
}
