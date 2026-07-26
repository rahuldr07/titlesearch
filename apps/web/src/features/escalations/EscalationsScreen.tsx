import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Ack,
  EscalationsResponse,
  ResolveEscalationRequest,
  RulesResponse,
} from "@titlepipe/contract";
import type { Escalation, Rule } from "@titlepipe/contract";
import { useMemo, useState } from "react";
import { api } from "../../api";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { RequiredComment } from "../../shared/ui/RequiredComment";
import { ScreenFrame } from "../../shared/ui/ScreenFrame";
import { EmptyState, Loading, Unavailable } from "../../shared/ui/states";

/**
 * Escalation inbox — the questions the rulebook could not answer, and the one
 * way out of them.
 *
 * RULING D1 (decided 2026-07-26, closes Q11/C11): resolution is REFUSED
 * WITHOUT A RULE. Two paths and there is no third — cite an existing LIVE rule,
 * or draft a new one, which lands PENDING, renders visibly inert, and cannot
 * affect the pipeline until an engineer confirms it. A ruling alone is not a
 * resolution: it answers these orders and nothing else, so the same question
 * returns next month (principle 3, "the same question is never asked twice").
 *
 * design-mock draws the looser flow — write a ruling, return, and *optionally*
 * convert it to a rule afterwards. That is OVERRIDDEN (conflict C11): the rule
 * step is inside resolution, and the submit is held until the rule exists.
 * D1 also withdrew the "does not generalise" middle path, so no such control is
 * offered here. A junk PENDING draft is inert and dies at the engineer gate;
 * an escalation resolving into nothing is invisible and compounds.
 *
 * NO TRIAGE SURFACE (orphan rule O4). No priority, no category, no assignee,
 * no age, no per-cluster count. The rule IS the resolution, so ranking and
 * routing have nothing to rank or route — the screen offers exactly ONE
 * combobox, the rule citation.
 *
 * "Open" is read as `resolution === null` because the contract has no status
 * field on `Escalation` and that IS its encoding — `authz.ts` gates
 * `escalation.resolve` on `when: { resolution: [null] }`. Nothing else here is
 * derived: the ruling, the resolver, the rule and its LIVE/PENDING/RETIRED
 * status are all rendered as the server sends them (constraint 9).
 *
 * CONTRACT GAP (1): `POST /api/escalations/{id}/resolve` answers with a bare
 * `Ack`. The rule it created comes back with no id and no code, so a drafted
 * rule's server-assigned code cannot be shown here, and one draft cannot be
 * shared across a cluster with more than one open question — each open
 * escalation gets its own PENDING draft. Return the rule (`{ ok, rule }`) and
 * both fall out for free. The screen discloses the split rather than hiding it.
 *
 * CONTRACT GAP (2): `Escalation` carries no `created_at`, no asker, and no
 * field pointer. The design's "2 orders · 9 days" meta and its per-field deep
 * link are therefore absent rather than guessed — `order_ids` names the order,
 * so the links go to the order's review without a `?field=` target.
 *
 * CONTRACT GAP (3): `ResolveEscalationRequest` admits `jurisdiction_scope` on a
 * draft, but no endpoint enumerates jurisdictions and the only control for it
 * would be a second combobox, which O4 and the invariant both forbid. It is
 * omitted, so the server records `null` — a free-text scope would be invented
 * data on a rule that governs the pipeline.
 */

/** One cluster = every escalation sharing a `field_path_cluster`. */
interface Cluster {
  key: string;
  open: Escalation[];
  answered: Escalation[];
}

/** The senior's receipt for an action, kept only to say what happened. Nothing
 *  reads it back and it dies with the screen (constraint 11: no browser
 *  storage). `ruleCode` is the SERVER's code for a cited rule, or null for a
 *  draft — whose code this screen is not told (gap 1) and will not invent. */
interface Receipt {
  cluster: string;
  kind: "cite" | "draft";
  ruleCode: string | null;
  ruleText: string;
}

/**
 * A rule's own status, rendered verbatim. The PENDING stamp is deliberately
 * loud and deliberately not a Chip: a rule that cannot affect the pipeline must
 * not look like the three that can. `InertPending` is the wrong component for
 * it — that one says "the backend does not define this yet", which is false
 * here; the backend defines a PENDING rule precisely, as inert.
 */
function RuleStamp({ rule }: { rule: Rule | null }) {
  if (rule === null) {
    return (
      <span className="text-tiny text-ink-muted">
        rule not shown — the rulebook did not load
      </span>
    );
  }
  if (rule.status === "pending") {
    return (
      <span
        data-testid="pending-stamp"
        className="inline-block rounded-xs border border-dashed border-state-attend-border bg-state-attend-surface px-2 py-px text-micro font-bold tracking-stamp text-state-attend-ink"
      >
        PENDING — CANNOT AFFECT THE PIPELINE UNTIL AN ENGINEER CONFIRMS
      </span>
    );
  }
  if (rule.status === "retired") {
    return <Chip tone="neutral">{`RETIRED — ${rule.code}`}</Chip>;
  }
  return <Chip tone="settled">{`LIVE IN PIPELINE — ${rule.code}`}</Chip>;
}

export function EscalationsScreen() {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<string | null>(null);
  const [mode, setMode] = useState<"cite" | "draft">("cite");
  /** Never pre-selected: the placeholder is the initial value, so no rule is
   *  ever offered as the answer before a senior chooses it. */
  const [ruleId, setRuleId] = useState("");
  /** Never pre-populated, for the same reason. */
  const [draft, setDraft] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const escalations = useQuery({
    queryKey: ["escalations"],
    queryFn: () => api(EscalationsResponse, "/api/escalations"),
  });

  const rules = useQuery({
    queryKey: ["rules"],
    queryFn: () => api(RulesResponse, "/api/rules"),
  });

  const resolve = useMutation({
    /**
     * The cluster is the unit of judgment — one question asked three times is
     * one question — but the endpoint is per-escalation, so the same ruling and
     * the same rule are filed against every open member. No new endpoint is
     * invented and no member is left half-answered.
     */
    mutationFn: async (v: { ids: string[]; body: ResolveEscalationRequest }) => {
      for (const id of v.ids) {
        await api(Ack, `/api/escalations/${id}/resolve`, {
          method: "POST",
          body: JSON.stringify(ResolveEscalationRequest.parse(v.body)),
        });
      }
    },
  });

  const clusters = useMemo<Cluster[]>(() => {
    const out: Cluster[] = [];
    const byKey = new Map<string, Cluster>();
    for (const e of escalations.data?.escalations ?? []) {
      let c = byKey.get(e.field_path_cluster);
      if (c === undefined) {
        c = { key: e.field_path_cluster, open: [], answered: [] };
        byKey.set(c.key, c);
        out.push(c);
      }
      if (e.resolution === null) c.open.push(e);
      else c.answered.push(e);
    }
    return out;
  }, [escalations.data]);

  const ruleById = useMemo(() => {
    const m = new Map<string, Rule>();
    for (const r of rules.data?.rules ?? []) m.set(r.id, r);
    return m;
  }, [rules.data]);

  /**
   * A PENDING or RETIRED rule cannot be cited: citing it would resolve an
   * escalation into something that cannot affect the pipeline, which is the
   * failure D1 exists to prevent. Only LIVE rules are offered.
   */
  const citable = (rules.data?.rules ?? []).filter((r) => r.status === "live");
  const cited = citable.find((r) => r.id === ruleId) ?? null;

  const active =
    picked !== null && clusters.some((c) => c.key === picked)
      ? picked
      : (clusters.find((c) => c.open.length > 0)?.key ?? clusters[0]?.key ?? null);
  const activeCluster = clusters.find((c) => c.key === active) ?? null;

  const pick = (key: string) => {
    setPicked(key);
    setMode("cite");
    setRuleId("");
    setDraft("");
    setReceipt(null);
  };

  /** The whole refusal, in one boolean: no rule, no resolution. */
  const ruleReady = mode === "cite" ? cited !== null : draft.trim() !== "";

  const submit = (ruling: string) => {
    if (activeCluster === null) return;
    let rule: ResolveEscalationRequest["rule"];
    let ruleCode: string | null;
    let ruleText: string;
    if (mode === "cite") {
      if (cited === null) return;
      rule = { rule_id: cited.id };
      ruleCode = cited.code;
      ruleText = cited.text;
    } else {
      const text = draft.trim();
      if (text === "") return;
      rule = { draft: { text } };
      ruleCode = null;
      ruleText = text;
    }
    const kind = mode;
    const cluster = activeCluster.key;
    resolve.mutate(
      { ids: activeCluster.open.map((e) => e.id), body: { ruling, rule } },
      {
        onSuccess: () => {
          setReceipt({ cluster, kind, ruleCode, ruleText });
          setMode("cite");
          setRuleId("");
          setDraft("");
          // The server is the author of what is open. This screen re-reads
          // both lists rather than editing its own copy of them.
          void qc.invalidateQueries({ queryKey: ["escalations"] });
          void qc.invalidateQueries({ queryKey: ["rules"] });
        },
      },
    );
  };

  return (
    <ScreenFrame
      eyebrow="Escalation inbox"
      title="The rule is the resolution"
      lede="Every question here was asked because the rulebook did not answer it. Resolving one means writing the answer down where the pipeline can read it — a ruling on its own leaves the question free to come back."
    >
      {receipt === null ? null : (
        <div
          data-testid="resolve-receipt"
          className="mb-5 rounded-lg border border-state-settled-border bg-state-settled-surface px-4 py-3"
        >
          <div className="font-semibold text-state-settled-ink">
            ✓ Rule written — cluster cleared.
          </div>
          <div className="mt-1 text-sm leading-relaxed text-ink-secondary">
            <span className="font-mono">{receipt.cluster}</span> is answered on
            the record. The rule below is the part that stops the question
            coming back.
          </div>
          <div className="mt-2 border-t border-state-settled-border pt-2">
            {receipt.kind === "cite" && receipt.ruleCode !== null ? (
              <>
                <Chip tone="settled">
                  {`LIVE IN PIPELINE — ${receipt.ruleCode}`}
                </Chip>
                <div className="mt-1 font-quote text-md leading-relaxed text-ink-primary">
                  {receipt.ruleText}
                </div>
              </>
            ) : (
              <>
                <span className="inline-block rounded-xs border border-dashed border-state-attend-border bg-state-attend-surface px-2 py-px text-micro font-bold tracking-stamp text-state-attend-ink">
                  PENDING — CANNOT AFFECT THE PIPELINE UNTIL AN ENGINEER
                  CONFIRMS
                </span>
                <div className="mt-1 font-quote text-md leading-relaxed text-ink-muted italic">
                  {receipt.ruleText}
                </div>
                <div className="mt-1 text-tiny leading-relaxed text-ink-muted">
                  Inert on arrival. It changes nothing in extraction, nothing in
                  assembly, and nothing in any report until an engineer confirms
                  it in the rulebook. Its code and version are assigned there,
                  not here.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mx-0.5 mb-2 flex flex-wrap items-baseline gap-2">
        <div className="text-xs font-bold tracking-eyebrow text-page-ref uppercase">
          Clusters
        </div>
        <div className="text-sm text-ink-muted">
          one question, however many times it was asked
        </div>
      </div>

      {escalations.isPending ? (
        <Loading what="the escalation inbox" />
      ) : escalations.isError ? (
        <Unavailable
          what="Inbox"
          detail={escalations.error.message}
          testId="escalations-unavailable"
        />
      ) : clusters.length === 0 ? (
        <EmptyState
          testId="escalations-empty"
          title="Nothing escalated."
          detail="The rulebook is answering what reviewers ask of it. That is the outcome this screen exists to produce, not a gap in it."
        />
      ) : (
        <>
          {clusters.map((c) => (
            <div key={c.key} className="mb-3">
              <Card edge={c.open.length === 0 ? "settled" : "decide"}>
                {/* The header row IS the selector — one click per cluster, and
                    nothing else to do to a cluster (O4: no triage). */}
                <button
                  type="button"
                  data-testid={`cluster-${c.key}`}
                  aria-current={c.key === active}
                  onClick={() => pick(c.key)}
                  className={`flex w-full flex-wrap items-center gap-3 border-b border-line-subtle px-4 py-2.5 text-left ${
                    c.key === active ? "bg-page-ref-surface" : "bg-surface-sunken"
                  }`}
                >
                  <span className="font-mono text-md font-semibold text-ink-primary">
                    {c.key}
                  </span>
                  {c.open.length === 0 ? (
                    <Chip tone="settled">ANSWERED</Chip>
                  ) : (
                    <Chip tone="decide">AWAITING A RULE</Chip>
                  )}
                  <span className="text-xs text-ink-muted">
                    {c.key === active ? "selected" : "select to resolve"}
                  </span>
                </button>
                <CardBody>
                  <ul>
                    {[...c.open, ...c.answered].map((e) => (
                      <li
                        key={e.id}
                        className="border-b border-line-subtle py-2 last:border-b-0"
                      >
                        {/* the reviewer's own words — serif is for human
                            testimony, never machine output */}
                        <div className="font-quote text-md leading-relaxed text-ink-primary">
                          “{e.question}”
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-tiny text-ink-muted">
                          <span className="tracking-badge uppercase">
                            Asked on
                          </span>
                          {e.order_ids.map((oid) => (
                            <Link
                              key={oid}
                              to="/orders/$orderId/review"
                              params={{ orderId: oid }}
                              search={{}}
                              className="font-mono text-page-ref-ink"
                            >
                              {oid}
                            </Link>
                          ))}
                        </div>
                        {e.resolution === null ? null : (
                          <div className="mt-2 rounded-md border border-line-subtle bg-surface-raised px-3 py-2">
                            <div className="text-micro font-bold tracking-badge text-ink-muted uppercase">
                              Ruling
                            </div>
                            <div className="font-quote text-md leading-relaxed text-ink-primary">
                              {e.resolution}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <RuleStamp
                                rule={
                                  e.rule_id === null
                                    ? null
                                    : ruleById.get(e.rule_id) ?? null
                                }
                              />
                              {e.resolved_by === null ? null : (
                                <span className="text-tiny text-ink-muted">
                                  resolved by {e.resolved_by}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            </div>
          ))}

          <div className="mx-0.5 mt-6 mb-2 flex flex-wrap items-baseline gap-2">
            <div className="text-xs font-bold tracking-eyebrow text-page-ref uppercase">
              Resolve
            </div>
            <div className="text-sm text-ink-muted">
              a ruling for these orders, a rule for every order after them
            </div>
          </div>

          {activeCluster === null ? null : activeCluster.open.length === 0 ? (
            <EmptyState
              testId="cluster-answered"
              title="This cluster is answered."
              detail="Its ruling and its rule are on the record above. Pick a cluster that is still awaiting a rule."
            />
          ) : (
            <Card testId="resolve-card" edge="decide">
              <CardHeader>
                Resolve {activeCluster.key} — the ruling and the rule together
              </CardHeader>
              <CardBody>
                <div className="rounded-md border border-state-halt-border bg-state-halt-surface px-3 py-2 text-sm leading-relaxed text-ink-secondary">
                  <span className="font-semibold text-state-halt-ink">
                    Resolution is refused without a rule.
                  </span>{" "}
                  Two paths, and there is no third: cite the live rule this
                  follows from, or draft a new one. A drafted rule lands PENDING
                  — inert on arrival, unable to touch the pipeline until an
                  engineer confirms it. The ruling on its own answers these
                  orders and nothing after them.
                </div>

                {/* The rule comes FIRST because it is the resolution; the
                    ruling's submit is the only submit on the card, so it sits
                    last and stays held until the rule above it exists. */}
                <fieldset className="mt-4 border-0 p-0">
                  <legend className="text-micro font-bold tracking-badge text-state-halt-ink uppercase">
                    The rule — required
                  </legend>
                  <label className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-ink-secondary">
                    <input
                      type="radio"
                      name="rule-path"
                      data-testid="mode-cite"
                      checked={mode === "cite"}
                      onChange={() => setMode("cite")}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-semibold text-ink-primary">
                        Cite an existing rule.
                      </span>{" "}
                      Most escalations are instances of a rule that is already
                      live — this path authors nothing.
                    </span>
                  </label>
                  <label className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-ink-secondary">
                    <input
                      type="radio"
                      name="rule-path"
                      data-testid="mode-draft"
                      checked={mode === "draft"}
                      onChange={() => setMode("draft")}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-semibold text-ink-primary">
                        Draft a new rule.
                      </span>{" "}
                      It lands PENDING and stays inert until an engineer
                      confirms it, so a draft can never quietly change a report.
                    </span>
                  </label>
                </fieldset>

                {mode === "cite" ? (
                  <div className="mt-4 max-w-[560px]">
                    <label
                      htmlFor="cite-select"
                      className="block text-micro font-bold tracking-badge text-state-halt-ink uppercase"
                    >
                      Which live rule does this follow from? — required
                    </label>
                    {/* The ONE combobox on this screen. Nothing is
                        pre-selected: the placeholder is the initial value, so
                        no rule is offered as the answer (D1). */}
                    <select
                      id="cite-select"
                      data-testid="cite-select"
                      value={ruleId}
                      onChange={(e) => setRuleId(e.target.value)}
                      className="mt-1 w-full rounded-sm border border-line-strong bg-surface-panel px-2 py-1.5 text-sm text-ink-primary"
                    >
                      <option value="">— choose a live rule —</option>
                      {citable.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.code} — {r.text}
                        </option>
                      ))}
                    </select>
                    {rules.isError ? (
                      <div className="mt-2">
                        <Unavailable
                          what="The rulebook"
                          detail={rules.error.message}
                          testId="rules-unavailable"
                        />
                      </div>
                    ) : (
                      <div className="mt-2 text-tiny leading-relaxed text-ink-muted">
                        Only LIVE rules are listed. A pending draft cannot be
                        cited — resolving into a rule that cannot affect the
                        pipeline resolves into nothing.
                      </div>
                    )}
                    {cited === null ? null : (
                      <div
                        data-testid="cited-rule"
                        className="mt-2 rounded-md border border-line-subtle bg-surface-raised px-3 py-2"
                      >
                        <Chip tone="settled">
                          {`LIVE IN PIPELINE — ${cited.code}`}
                        </Chip>
                        <div className="mt-1 font-quote text-md leading-relaxed text-ink-primary">
                          {cited.text}
                        </div>
                        <div className="mt-1 text-tiny text-ink-muted">
                          origin {cited.origin} · v{cited.version}
                          {cited.jurisdiction_scope === null
                            ? null
                            : ` · scope ${cited.jurisdiction_scope}`}
                          {cited.confirmed_by === null
                            ? null
                            : ` · confirmed by ${cited.confirmed_by}`}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 max-w-[560px]">
                    <label
                      htmlFor="draft-input"
                      className="block text-micro font-bold tracking-badge text-state-halt-ink uppercase"
                    >
                      Draft the rule — required
                    </label>
                    {/*
                      A plain field, deliberately: RequiredComment owns its own
                      text AND its own submit, and this card has ONE submit for
                      TWO required values. The ruling holds the submit (below),
                      so the draft is lifted here to hold it back. The refusal
                      is not weakened by that — the submit is disabled while
                      this is empty and its label names the draft as what is
                      missing, which is the O10 requirement stated on the
                      control the user is actually reaching for.
                    */}
                    <textarea
                      id="draft-input"
                      data-testid="draft-input"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={3}
                      placeholder="one sentence a reviewer can apply without asking again"
                      className="mt-1 w-full resize-y rounded-sm border border-line-strong bg-surface-panel px-2 py-1.5 font-sans text-sm text-ink-primary"
                    />
                    <div className="mt-2 text-tiny leading-relaxed text-ink-muted">
                      Never pre-filled — the rule is written, not accepted. It
                      arrives inert and an engineer decides whether it joins the
                      rulebook.
                    </div>
                    {activeCluster.open.length > 1 ? (
                      <div className="mt-2 rounded-md border border-state-attend-border bg-state-attend-surface px-2 py-1.5 text-tiny leading-relaxed text-state-attend-ink">
                        This cluster holds more than one open question. Resolve
                        is per-escalation and answers with a bare ack, so the
                        draft is filed against each of them rather than shared —
                        the engineer gate sees the duplicates. Citing an
                        existing rule has no such split.
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="mt-4 max-w-[560px] border-t border-line-subtle pt-3">
                  <RequiredComment
                    // Remounts per cluster so a ruling written for one question
                    // can never be submitted against another.
                    key={activeCluster.key}
                    label="Your ruling for these orders — required"
                    placeholder="what is the answer, in words a reviewer can apply?"
                    nudge="The ruling is missing. The rule says what to do next time; the ruling says what the answer is for the orders in front of you. Both are recorded, and neither substitutes for the other."
                    submitLabel={
                      ruleReady
                        ? "Resolve — write this rule in"
                        : mode === "cite"
                          ? "Resolve — held until a rule is cited"
                          : "Resolve — held until the rule is drafted"
                    }
                    testId="ruling-input"
                    submitTestId="resolve-btn"
                    nudgeTestId="ruling-nudge"
                    multiline
                    disabled={!ruleReady || resolve.isPending}
                    onSubmit={submit}
                  />
                  {resolve.isError ? (
                    <div
                      data-testid="resolve-failed"
                      className="mt-2 rounded-md border border-state-halt-border bg-state-halt-surface px-2 py-1.5 text-sm text-state-halt-ink"
                    >
                      {resolve.error.message}
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 text-tiny leading-relaxed text-ink-muted">
                  <span className="font-semibold text-ink-secondary">
                    no category, no priority, no assignee — just the rule
                  </span>{" "}
                  · Ranking these would only decide which unanswered question
                  stays unanswered longer, and the rule is what removes them.
                  The server owns everything else: which cluster is open, who
                  resolved it, and whether a drafted rule ever goes live.
                </div>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </ScreenFrame>
  );
}
