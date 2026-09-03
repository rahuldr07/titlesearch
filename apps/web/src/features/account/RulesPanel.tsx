import { useState } from "react";
import { useRead } from "../../app/useRead";
import { rules } from "../../shared/accountQueries";
import { Badge, Card, Input, Label, Segment, SegmentedControl } from "../../components/ui";
import { PanelFrame } from "./AccountPanel";
import { QueryState } from "../../entities/state/QueryState";
import { RulesGaps } from "./RulesGaps";

/**
 * Rules & routing — the rulebook, filtered in the browser, with pending
 * rules drawn as visibly inert.
 */
export function RulesPanel() {
  const book = useRead(rules);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");

  return (
    <PanelFrame
      title="Rules & routing"
      note="The rulebook every ruling cites. Read-only here; a rule is confirmed on the engineer's door, beside the evidence for it."
    >
      <QueryState query={book} of="the rulebook">
        {(data) => {
          const needle = query.trim().toLowerCase();
          const shown = data.rules.filter(
            (rule) =>
              (status === "all" || rule.status === status) &&
              (needle === "" ||
                rule.code.toLowerCase().includes(needle) ||
                rule.text.toLowerCase().includes(needle) ||
                rule.origin.toLowerCase().includes(needle) ||
                (rule.jurisdiction_scope ?? "").toLowerCase().includes(needle)),
          );

          return (
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div className="flex min-w-140 flex-col gap-2">
                  <Label htmlFor="rule-filter">Filter</Label>
                  {/*
                   * Uncontrolled, forced rather than chosen: `InputProps`
                   * omits `value` and `defaultValue` — the value belongs to
                   * react-aria's `TextField`, which the kit does not export.
                   * A filter has no second writer to stay in sync with.
                   */}
                  <Input
                    id="rule-filter"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Rule code, text, origin or scope"
                  />
                </div>
                {/* Both numbers describe this list, not the shop — a total
                    here is the length of what arrived, and "shown" scopes
                    the claim to the rows on screen. */}
                <span className="font-mono text-meta leading-close text-ink-muted">
                  {shown.length} of {data.rules.length} shown
                </span>
              </div>

              {/* Status chips, on the server's own `Rule.status` enum. Scope
                  chips are not here: "Global / Product / Jurisdiction" needs
                  a layer no rule carries, and the ask for one is stated
                  below rather than approximated. */}
              <SegmentedControl
                label="Filter by status"
                selectedKeys={new Set([status])}
                onSelectionChange={(keys) => {
                  setStatus(String([...keys][0] ?? "all"));
                }}
              >
                <Segment id="all">All</Segment>
                <Segment id="live">Live</Segment>
                <Segment id="pending">Pending</Segment>
                <Segment id="retired">Retired</Segment>
              </SegmentedControl>

              {shown.length === 0 ? (
                <Card>
                  <p className="text-meta leading-body text-ink-secondary">
                    No rule matches that. This is a filter over the rulebook the server
                    sent, not an empty rulebook — clear the box and the status filter to
                    see it again.
                  </p>
                </Card>
              ) : (
                <Card padding="none">
                  <ul>
                    {shown.map((rule) => (
                      <li
                        key={rule.id}
                        /*
                         * Named for the machine, not the reader. `e2e-live/`
                         * asserts this row is ABSENT when core-api is down, and
                         * an absence assertion is only worth its salt if the
                         * same selector can find the row when it IS there — so
                         * the id has to survive a restyle. Keyed on `code`
                         * rather than `id` because the seeded fixture and the
                         * live database agree on `R13` and disagree on uuids.
                         */
                        data-testid={`rule-row-${rule.code}`}
                        className="flex flex-col gap-4 border-b border-line-subtle px-12 py-8 last:border-b-0"
                      >
                        <div className="flex flex-wrap items-baseline gap-6">
                          {/* A rule code is an identifier, so it is mono. */}
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

              <RulesGaps />
            </div>
          );
        }}
      </QueryState>
    </PanelFrame>
  );
}
