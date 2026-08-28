import { useState } from "react";
import { useRead } from "../../app/useRead";
import { rules } from "../../shared/accountQueries";
import { Badge, Card, Input, Label } from "../../components/ui";
import { PanelFrame } from "./AccountPanel";
import { QueryState } from "../../entities/state/QueryState";

/**
 * RULES & ROUTING — the rulebook, filtered in the browser, and PENDING drawn as
 * inert.
 *
 * ══ WHY FILTERING IS LEGAL HERE AND NOT ON THE QUEUE ═══════════════════════
 *
 * This looks like the affordance `CONFLICT-all-orders.md` spends four pages
 * refusing, and it is not. INVARIANT 22 governs the QUEUE — "a single
 * server-chosen next order, no list, no browsing, no cherry-picking" — and what
 * it protects is WORK SELECTION: a reviewer must not be able to pick which
 * order they take. The rulebook is not work. It is the reference document every
 * ruling cites, `GET /api/rules` returns it whole because it is meant to be
 * read whole, and no row here carries a way to take anything.
 *
 * The test that separates the two: filtering this list changes what you can
 * READ; filtering the queue would change what you can DO. There is no claim
 * token, no assignment and no ordering the caller can influence on either — but
 * only one of them hands out work.
 *
 * The filter is component state rather than a URL key for the reason
 * `accountSearch.ts` gives: a bookmarkable rulebook filter is a second
 * rulebook.
 *
 * ══ PENDING RENDERS VISIBLY INERT ══════════════════════════════════════════
 *
 * INVARIANT 38: "A drafted rule lands PENDING and renders visibly inert — it
 * cannot affect the pipeline until an engineer confirms." AGENTS.md says the
 * same as a hard rule. So `status` is not a neutral chip: a PENDING rule is
 * marked as not in force, in the attend register, with the sentence saying so
 * rather than a colour a reader has to decode.
 *
 * The confirm action is NOT drawn. `POST /api/rules/{id}/confirm` exists and is
 * the engineer's, and `authz.ts` grants it by role — but this pane is reached
 * by EVERY role (`screen.account.enter`, EVERYONE), and putting a
 * pipeline-affecting mutation on the settings screen for whoever opens it is
 * how a confirmation gets made by somebody who was reading. It belongs on the
 * engineer's own door, next to the evidence for confirming.
 */
export function RulesPanel() {
  const book = useRead(rules);
  const [query, setQuery] = useState("");

  return (
    <PanelFrame
      title="Rules & routing"
      note="The rulebook every ruling cites. Read-only here; a rule is confirmed on the engineer's door, beside the evidence for it."
    >
      <QueryState query={book} of="the rulebook">
        {(data) => {
          const needle = query.trim().toLowerCase();
          const shown =
            needle === ""
              ? data.rules
              : data.rules.filter(
                  (rule) =>
                    rule.code.toLowerCase().includes(needle) ||
                    rule.text.toLowerCase().includes(needle) ||
                    rule.origin.toLowerCase().includes(needle) ||
                    (rule.jurisdiction_scope ?? "").toLowerCase().includes(needle),
                );

          return (
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div className="flex min-w-140 flex-col gap-2">
                  <Label htmlFor="rule-filter">Filter</Label>
                  {/*
                   * UNCONTROLLED, and that is forced rather than chosen.
                   * `InputProps` omits `value` and `defaultValue` (REVIEW-03
                   * B2): the value belongs to react-aria's `TextField`, which
                   * this kit does not export. `onChange` still passes through,
                   * and nothing but the reader ever sets this box — a filter
                   * has no second writer to stay in sync with.
                   */}
                  <Input
                    id="rule-filter"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Rule code, text, origin or scope"
                  />
                </div>
                {/* Both numbers describe THIS LIST, not the shop.
                    `RulesResponse` carries no server count, so any total here
                    is the length of what arrived — legal for a list the caller
                    filters itself, and not INVARIANT 5's census pattern,
                    because "shown" scopes the claim to the rows on screen. */}
                <span className="font-mono text-meta leading-close text-ink-muted">
                  {shown.length} of {data.rules.length} shown
                </span>
              </div>

              {shown.length === 0 ? (
                <Card>
                  <p className="text-meta leading-body text-ink-secondary">
                    No rule matches that. This is a filter over the rulebook
                    the server sent, not an empty rulebook — clear the box to
                    see it again.
                  </p>
                </Card>
              ) : (
                <Card padding="none">
                  <ul>
                    {shown.map((rule) => (
                      <li
                        key={rule.id}
                        className="flex flex-col gap-4 border-b border-line-subtle px-12 py-8 last:border-b-0"
                      >
                        <div className="flex flex-wrap items-baseline gap-6">
                          {/* Rule 3: a rule code is an identifier. */}
                          <span className="font-mono text-meta font-semibold leading-close text-ink-secondary">
                            {rule.code}
                          </span>
                          <span className="text-label leading-flat text-ink-faint">
                            {rule.origin}
                            {rule.jurisdiction_scope !== null &&
                              ` · ${rule.jurisdiction_scope}`}
                          </span>
                          {rule.status === "pending" ? (
                            <Badge tone="attend">Pending — not in force</Badge>
                          ) : rule.status === "live" ? (
                            <Badge tone="settled">Live</Badge>
                          ) : (
                            <span className="text-label leading-flat text-ink-disabled">
                              Retired
                            </span>
                          )}
                        </div>
                        <p className="text-meta leading-body text-ink-primary">
                          {rule.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          );
        }}
      </QueryState>
    </PanelFrame>
  );
}
