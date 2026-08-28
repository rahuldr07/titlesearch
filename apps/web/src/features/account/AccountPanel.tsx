import type { AccountTabId } from "../../app/accountSearch";
import { ContractGap } from "../../entities/contract/ContractGap";
import { PeoplePanel } from "./PeoplePanel";
import { AccessPanel } from "./AccessPanel";
import { RulesPanel } from "./RulesPanel";
import { SecurityPanel } from "./SecurityPanel";
import { AuditPanel } from "./AuditPanel";

/**
 * WHICH PANE. A switch over the closed `AccountTabId` union, so adding a tab to
 * `accountTabs.ts` without a pane here is a compile error rather than a blank
 * region — the exhaustiveness is the point of the union.
 *
 * The Organization pane is the one that is entirely gap, and it is drawn here
 * rather than given a file of its own because there is nothing in it to
 * decompose: no organisation entity exists anywhere in `packages/contract`, so
 * there is no shape to render, no partial to fill in and nothing to fetch.
 */
export function AccountPanel(props: { readonly tab: AccountTabId }) {
  switch (props.tab) {
    case "people":
      return <PeoplePanel />;
    case "access":
      return <AccessPanel />;
    case "rules":
      return <RulesPanel />;
    case "security":
      return <SecurityPanel />;
    case "audit":
      return <AuditPanel />;
    case "org":
      return (
        <PanelFrame
          title="Organization"
          note="Tenant identity, billing and the org-wide defaults."
        >
          <ContractGap
            drawn="Organization settings — org name, tenant identity, product baseline defaults and billing (design §Settings, Organization pane)"
            has={
              <>
                Nothing. There is no organisation entity in{" "}
                <code className="font-mono text-label">packages/contract</code> —
                no tenant, no org profile, no billing shape, and no endpoint that
                names one. The product is single-tenant and internal-first
                (PRODUCT.md, &ldquo;Internal use first; SaaS later&rdquo;), so
                the surface the prototype draws is one the backend has not been
                asked for yet rather than one that was dropped.
              </>
            }
            needs={
              <>
                An organisation shape and a door for it. It is the pane most
                likely to be genuinely premature: a settings form that looks
                saveable and is not is worse than an absent one, and a product
                baseline nobody can cite is the kind of value AGENTS.md&rsquo;s
                sixth principle exists to stop.
              </>
            }
          />
        </PanelFrame>
      );
  }
}

/**
 * THE PANE HEADER, shared by all six. The prototype draws an h2 at 28px with a
 * 13px grey line under it and a 24px gap to the content; that pairing is the
 * only thing every pane has in common, so it lives here rather than six times.
 */
export function PanelFrame(props: {
  readonly title: string;
  readonly note: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-12">
      <div className="flex flex-col gap-2">
        <h2 className="text-title font-semibold leading-tight text-ink-primary">
          {props.title}
        </h2>
        <p className="text-meta leading-body text-ink-muted">{props.note}</p>
      </div>
      {props.children}
    </section>
  );
}
