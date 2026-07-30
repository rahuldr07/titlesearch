import { Link } from "@tanstack/react-router";
import type { Rule } from "@titlepipe/contract";
import type { Cluster } from "./ClusterRail";
import { ResolveCard } from "./ResolveCard";
import { RuleStamp } from "./RuleStamp";
import { Card } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { DividedSection, ListRow } from "../../shared/ui/ListRow";

/**
 * ONE CLUSTER: what people asked, and the one control that answers all of it.
 *
 * RULE: the escalated thing is named, not encoded. FAILURE PREVENTED: the whole
 * heading was `judgments.hit_identity` in 13px mono, so a senior had to decode
 * a dotted identifier to know which wall they were looking at. The path splits
 * into the design's own header composition — section as a tinted chip, leaf as
 * the heading. CONTRACT GAP: `Escalation` carries only `field_path_cluster`, so
 * there is no human title on the wire; a client-side label map would put the
 * field taxonomy in a browser, which is the one place it must never live. Ask
 * for `cluster_label` and this splits back into one string.
 *
 * RULE: human prose is a distinct register (§4.2 — the design sets every quoted
 * human sentence in the serif behind a rule). FAILURE PREVENTED: the questions
 * were bare sans paragraphs in an unbordered list whose within-item gap (2px)
 * was smaller than its between-item gap (6px), so an order link sat almost as
 * close to the NEXT question as to its own. The card and the row hairline carry
 * the grouping now, and the serif says a person wrote this.
 *
 * RULE: an order reference is an affordance, and the design draws every one as
 * a tinted mono chip. FAILURE PREVENTED: underlined mono links were the only
 * underlines in the screen body and read as unstyled markup. `normal-case`
 * because an order id is an identifier — casing it would change what it says.
 *
 * THE AMBER TOP EDGE IS THE HELD REGISTER, the same 2px `Card` accent the
 * export puts on the field card. Only the open cluster wears it: a cluster with
 * its rule written is not held any more, and the settled card says so itself.
 */
export function ClusterDetail({
  cluster,
  rules,
  onResolved,
}: {
  cluster: Cluster;
  rules: readonly Rule[];
  onResolved: () => void;
}) {
  const answered = cluster.items.find((item) => item.resolution !== null);
  const open = cluster.open.length > 0;
  const cut = cluster.path.lastIndexOf(".");
  const section = cut === -1 ? null : cluster.path.slice(0, cut);
  const leaf = cut === -1 ? cluster.path : cluster.path.slice(cut + 1);

  return (
    <section className="flex max-w-440 flex-col gap-6">
      <div className="flex flex-wrap items-baseline gap-4">
        {section === null ? null : (
          <Chip tone="attend" size="md">
            {section}
          </Chip>
        )}
        <h2 className="font-mono text-md font-semibold text-ink-primary">{leaf}</h2>
      </div>

      <Card accent={open ? "attend" : "none"}>
        <DividedSection>
          {cluster.items.map((item) => (
            <ListRow key={item.id} className="flex flex-col gap-4">
              <blockquote className="border-l-(length:--stroke-accent) border-state-attend-border pl-5 font-quote text-base leading-body text-ink-secondary">
                &ldquo;{item.question}&rdquo;
              </blockquote>
              {/*
                YOU LAND ON THE ORDER THE QUESTION CAME FROM. The design of
                record's framing is "you land on the field in question, not the
                top of the order" — CONTRACT GAP: `Escalation` carries
                `order_ids` and a cluster path, but no field id, no asker and no
                timestamp, so the order is as close as the data allows and the
                field itself cannot be targeted.
              */}
              <p className="flex flex-wrap gap-3">
                {item.order_ids.map((orderId) => (
                  <Link key={orderId} to="/orders/$orderId/review" params={{ orderId }}>
                    <Chip tone="action" size="sm" shape="mono" bordered className="normal-case">
                      {orderId} →
                    </Chip>
                  </Link>
                ))}
              </p>
            </ListRow>
          ))}
        </DividedSection>
      </Card>

      {open ? (
        <ResolveCard
          ids={cluster.open.map((item) => item.id)}
          rules={rules}
          onResolved={onResolved}
        />
      ) : (
        <Card tone="settled" className="flex flex-col gap-4 p-8">
          <p className="text-md font-semibold text-state-settled-ink">
            ✓ Rule written — cluster cleared.
          </p>
          {answered === undefined ? null : (
            <>
              <blockquote className="border-l-(length:--stroke-accent) border-state-settled-border pl-5 font-quote text-base leading-body text-ink-secondary">
                &ldquo;{answered.resolution}&rdquo; — {answered.resolved_by}
              </blockquote>
              <div>
                <RuleStamp rule={rules.find((rule) => rule.id === answered.rule_id)} />
              </div>
            </>
          )}
        </Card>
      )}
    </section>
  );
}
