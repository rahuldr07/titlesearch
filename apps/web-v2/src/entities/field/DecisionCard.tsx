import { EngineReadings, type Reading } from "./EngineReadings";
import { DecisionBar } from "./DecisionBar";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Chip } from "../../shared/ui/Chip";
import { Card, CardBody } from "../../shared/ui/Card";
import { cn } from "../../shared/ui/classNames";

/**
 * The reviewer's unit of work.
 *
 * THE QUESTION FRAMING IS THE DESIGN'S BEST IDEA and is kept: presenting a
 * flagged field as a question the reviewer answers ("Read the lot number — or
 * escalate if the page can't support a decision") beats a flag they must
 * interpret. What is dropped is the answer the export supplied with it.
 *
 * ASSUMPTION, STATED (BRIEF §12): conflict C7 / ruling **Q2** is not formally
 * confirmed. This card resolves it the way the invariants require — both
 * readings attributed, neither pre-selected (`review.spec` #3, CONTEXT §8.3) —
 * and keeps the design's question framing above them. The ARRANGEMENT of those
 * two things is my composition, not something the design drew. If Q2 resolves
 * differently, this layout changes; the invariants it satisfies do not.
 *
 * `state` and `stateLabel` are SERVER-SUPPLIED. Constraint 9 forbids deriving
 * status in the browser, and `server-owns-state.spec` (2 INVARIANTs) pins that
 * confidence never promotes or demotes a field.
 */
export type DecisionState = "pending" | "confirmed" | "corrected" | "escalated" | "notparty";

const STATE_TONE = {
  pending: "attend",
  confirmed: "settled",
  corrected: "action",
  escalated: "attend",
  notparty: "settled",
} as const satisfies Record<DecisionState, "attend" | "settled" | "action">;

/** What the reviewer is being asked about. */
export interface DecisionField {
  section: string;
  label: string;
  /** The question put to the reviewer. */
  asking: string;
  /** Why this field was flagged — server-authored. */
  why: string;
}

/** Server-supplied. Never derived from confidence or from `value === null`. */
export interface DecisionStatus {
  state: DecisionState;
  /** Server-supplied display text for that state. */
  label: string;
}

/** Everything the reviewer can do here, in one place. */
export interface DecisionActions {
  onConfirm: () => void;
  onCorrect: () => void;
  onEscalate: () => void;
  onAdopt: (reading: Reading) => void;
  onViewSource?: ((page: number) => void) | undefined;
  onNotOurParty?: (() => void) | undefined;
  /** Identity fields only — excluding a judgment belonging to another person. */
  canExclude?: boolean;
}

/**
 * Sixteen props became six. The three groups below are the card's three
 * genuine concerns, and the flat list was hiding that they were unrelated —
 * §6's "more than ~7 props means wrong decomposition" was right, and the
 * callbacks for `EngineReadings` and `DecisionBar` were being threaded through
 * a card that never touches them.
 */
export function DecisionCard({
  field,
  status,
  readings,
  actions,
  expanded,
  onExpand,
}: {
  field: DecisionField;
  status: DecisionStatus;
  readings: readonly Reading[];
  actions: DecisionActions;
  expanded: boolean;
  onExpand: () => void;
}) {
  return (
    <Card accent={expanded ? "action" : "none"}>
      <button
        type="button"
        onClick={onExpand}
        aria-expanded={expanded}
        className={cn(
          "flex w-full flex-wrap items-center gap-4 px-8 py-6 text-left",
          expanded && "border-b border-line-subtle",
        )}
      >
        <Eyebrow variant="caption">{field.section}</Eyebrow>
        <span className="flex-1 text-md font-semibold text-ink-primary">{field.label}</span>
        <Chip tone={STATE_TONE[status.state]} size="sm">
          {status.label}
        </Chip>
      </button>

      {expanded ? (
        <CardBody>
          <p className="text-md font-semibold text-ink-primary">{field.asking}</p>
          <p className="mt-2 text-base leading-body text-ink-secondary">{field.why}</p>

          <div className="mt-8">
            <EngineReadings
              readings={readings}
              onAdopt={actions.onAdopt}
              onViewSource={actions.onViewSource}
            />
          </div>

          <div className="mt-8">
            <DecisionBar
              onConfirm={actions.onConfirm}
              onCorrect={actions.onCorrect}
              onEscalate={actions.onEscalate}
              onNotOurParty={actions.onNotOurParty}
              canExclude={actions.canExclude ?? false}
            />
          </div>
        </CardBody>
      ) : null}
    </Card>
  );
}
