# [Wave 5] — Copy and Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the export's load-bearing sentences, land every `density` divergence, correct the three WHY comments that assert invariants the code does not hold, and record every deliberate departure in `conflicts.md`.

**Architecture:** Two gates carry this wave. `src/shared/exportCopy.test.ts` pins what a screen SAYS to a user; `src/shared/whyComments.test.ts` pins what the source says to the next engineer. Both are source-grep gates in the register of the existing `vocabulary.test.ts` — node env, no DOM, collected by the `gates` vitest project — because the alternative (lifting twenty inline sentences into a constants module) moves the words away from the markup that reads them, which is how the paraphrases got in. Density work is per-component rhythm only: the shell/screen padding findings belong to `Screen` and are already spent in Waves 0 and 4.

**Prerequisites:** Waves 0, 1, 2, 3 and 4 complete. This wave is last on purpose — every spacing it sets would move again if the frame were still changing, and several strings it pins live in fixtures Wave 2 rewrote.

**Constraints:** The Global Constraints in the plan index apply to every task. Unique to this wave: **every restored sentence is compared verbatim, on collapsed whitespace, against the export** — a near-miss ("shown apart from" for "counted separately from") is the exact defect this wave exists to remove, so no paraphrase is acceptable however well it reads; and **line ranges below are 2026-07-30 anchors** — Waves 3 and 4 moved code, so the authoritative locator is the quoted string, not the number. Grep for it.

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `apps/web-v2/src/shared/exportCopy.test.ts` | The copy gate: every load-bearing export sentence, per file, present verbatim and its paraphrase absent. |
| `apps/web-v2/src/shared/whyComments.test.ts` | The WHY gate: the three corrected comment claims present, the three false ones absent anywhere in `src/`. |
| `apps/web-v2/src/shared/plural.ts` | `count(n, one, many?)` — one place that stops `1 orders`. |
| `apps/web-v2/src/shared/plural.test.ts` | Node test over `count`. |
| `apps/web-v2/src/entities/signoff/SignoffLineTitle.tsx` | `Sign-off line N · label` — the string that ties a gap back to the sheet. |
| `apps/web-v2/src/features/audit/actionLabels.ts` | The closed action vocabulary said out loud; unmapped falls through to the token. |
| `apps/web-v2/src/features/audit/actionLabels.test.ts` | Node test over the map: mapped, distinct, and the fall-through. |
| `apps/web-v2/src/features/processing/StageRow.stories.tsx` | Proves the three owners render one identical label — the claim the corrected WHY comment makes. |

**Modified**

| File | Change |
|---|---|
| `apps/web-v2/src/features/overview/FailedBanner.tsx` | "counted separately from" restored. |
| `apps/web-v2/src/features/questions/SignoffCard.tsx` | "this signs your work" restored. |
| `apps/web-v2/src/features/rulebook/RetireBlock.tsx` | trailing "does" dropped. |
| `apps/web-v2/src/features/completeness/GapCard.tsx` | line-number title; the design's uneven card rhythm. |
| `apps/web-v2/src/features/review/NoDisclosureCards.tsx` | second copy of the title string replaced by the component. |
| `packages/mocks/src/workspace.ts` | gate rows name themselves; `Held — …` / `Waits until …` details. |
| `apps/web-v2/src/features/audit/AuditRow.tsx` | rows read as sentences; the entity reference is labelled. |
| `apps/web-v2/src/features/escalations/ResolveCard.tsx` | both textareas get the export's placeholders. |
| `apps/web-v2/src/features/escalations/ClusterRail.tsx` | `count()` instead of an unconditional `orders`. |
| `apps/web-v2/src/features/queue/NextOrderCard.tsx` | the on-screen key hint removed. |
| `apps/web-v2/src/features/review/DecisionPanel.tsx` | the bare `Report pipeline bug` line removed. |
| `apps/web-v2/src/app/AppChrome.tsx` | WHY comment states the rule instead of restating the splice. |
| `apps/web-v2/src/app/OrderCounts.tsx` | the false "always visible" comment replaced by the rule that holds. |
| `apps/web-v2/src/features/processing/StageRow.tsx` | WHY comment says the RENDER governs, not the markup. |
| `apps/web-v2/src/shared/ui/Button.tsx` | `xl` to the design's 44px; new `section` rung. |
| `apps/web-v2/src/features/products/ProductList.tsx`, `LineCatalogue.tsx`, `apps/web-v2/src/features/delivered/ArtifactCard.tsx` | adopt `size="section"`. |
| `apps/web-v2/src/index.css` | `@utility grid-autofill-230`. |
| `apps/web-v2/src/features/clients/SignoffDefaults.tsx` | auto-fill track instead of a fixed two-column grid. |
| `apps/web-v2/src/features/gallery/StateCard.tsx` | sample top-aligned. |
| `apps/web-v2/src/features/overview/StageBoard.tsx`, `TallyStrip.tsx` | board gap and tally cell padding. |
| `docs/frontend/conflicts.md` | five deliberate departures recorded. |

---

### Task 1: The copy gate, and the three sentences the app paraphrased

**Files:**
- Create: `apps/web-v2/src/shared/exportCopy.test.ts`
- Modify: `apps/web-v2/src/features/overview/FailedBanner.tsx:34-38`
- Modify: `apps/web-v2/src/features/questions/SignoffCard.tsx:59-63`
- Modify: `apps/web-v2/src/features/rulebook/RetireBlock.tsx:78-83`
- Test: `apps/web-v2/src/shared/exportCopy.test.ts`

**Interfaces:**
- Consumes: nothing. Pure source inspection.
- Produces: `interface CopyCheck { file: string; must?: readonly string[]; gone?: readonly string[] }` and the exported-by-file-position `CHECKS: readonly CopyCheck[]` array that Tasks 2–6 append to. `file` is a path relative to `apps/web-v2`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web-v2/src/shared/exportCopy.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

/**
 * The export's load-bearing sentences, pinned to the file that must say them.
 *
 * A PARAPHRASE IS A DIFFERENT CLAIM. "Counted separately from" says the number
 * did not move; "shown apart from" describes only where the block sits. "This
 * signs your work" tells an abstractor the press is a signature. Every entry
 * below is a sentence the audit found rewritten into something weaker, and the
 * rewrite is invisible to every other gate we run.
 *
 * A GREP, NOT A CONSTANTS MODULE. Lifting these into `copy.ts` would move the
 * words away from the markup that reads them, which is how they drifted in the
 * first place; a test that reads the source keeps the sentence where a reviewer
 * of that screen will see it.
 *
 * Matching is on COLLAPSED WHITESPACE because JSX wraps text at the printer's
 * whim, and a reformat must not read as a copy change.
 */
interface CopyCheck {
  file: string;
  /** Present, verbatim. */
  must?: readonly string[];
  /** Absent — the paraphrase this replaced, or a line ruled off the screen. */
  gone?: readonly string[];
}

const CHECKS: readonly CopyCheck[] = [
  {
    file: "src/features/overview/FailedBanner.tsx",
    must: ["counted separately from the stages above rather than hidden inside one"],
    gone: ["shown apart from the stages above"],
  },
  {
    file: "src/features/questions/SignoffCard.tsx",
    must: ["sign-off lines answered — this signs your work and starts the pipeline."],
    gone: ["answered — signing starts the pipeline."],
  },
  {
    file: "src/features/rulebook/RetireBlock.tsx",
    must: ["it changes extraction as much as confirming."],
    gone: ["as much as confirming does."],
  },
  {
    // Already verbatim. Pinned so the next reader cannot "tidy" it: this is the
    // one sentence that tells a reader a PENDING rule is not policy yet.
    file: "src/features/rulebook/NewRuleForm.tsx",
    must: ["PENDING — AFFECTS NOTHING YET"],
  },
];

test("every load-bearing export sentence is on screen, verbatim", () => {
  const offenses: string[] = [];
  for (const check of CHECKS) {
    const flat = readFileSync(join(process.cwd(), check.file), "utf8").replace(/\s+/g, " ");
    for (const phrase of check.must ?? []) {
      if (!flat.includes(phrase)) offenses.push(`${check.file} LOST: ${phrase}`);
    }
    for (const phrase of check.gone ?? []) {
      if (flat.includes(phrase)) offenses.push(`${check.file} STILL CARRIES: ${phrase}`);
    }
  }
  expect(offenses).toEqual([]);
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=gates exportCopy
```

Expected failure — six entries in the array, three of them differing at both ends:

```
AssertionError: expected [ 'src/features/overview/FailedBanner.tsx LOST: …', … ] to deeply equal []
  - src/features/overview/FailedBanner.tsx LOST: counted separately from the stages above rather than hidden inside one
  - src/features/overview/FailedBanner.tsx STILL CARRIES: shown apart from the stages above
  - src/features/questions/SignoffCard.tsx LOST: sign-off lines answered — this signs your work and starts the pipeline.
  - src/features/questions/SignoffCard.tsx STILL CARRIES: answered — signing starts the pipeline.
  - src/features/rulebook/RetireBlock.tsx LOST: it changes extraction as much as confirming.
  - src/features/rulebook/RetireBlock.tsx STILL CARRIES: as much as confirming does.
```

- [ ] **Step 3: Implement**

In `FailedBanner.tsx`, replace the paragraph body:

```tsx
        <p className="mt-2 max-w-4xl text-xs leading-body text-ink-secondary">
          A failed order is not late, it is out. It needs a person to put it
          back, and it will sit here until someone does — which is why it is
          counted separately from the stages above rather than hidden inside
          one.
        </p>
```

In `SignoffCard.tsx`, the `ready` branch of `startNote`:

```tsx
  const startNote = ready
    ? `All ${lines.length} sign-off lines answered — this signs your work and starts the pipeline.`
    : remaining > 0
      ? `${remaining} of ${lines.length} still to answer. All are required to start.`
      : "Every NO needs a comment before you can start.";
```

In `RetireBlock.tsx`, the restricted note:

```tsx
        <p className="rounded-7 border border-state-halt-border bg-state-halt-surface px-6 py-5 text-sm leading-body text-state-halt-ink">
          Retiring is restricted to engineer and admin — it changes extraction as
          much as confirming.
        </p>
```

Leave `ConfirmBlock.tsx`'s `RESTRICTED` constant where it is. Lifting the two refusal strings into one module is a reuse proposal, and reuse is Waves 1 and 3; this wave only makes the words right.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=gates exportCopy
```

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/shared/exportCopy.test.ts apps/web-v2/src/features/overview/FailedBanner.tsx apps/web-v2/src/features/questions/SignoffCard.tsx apps/web-v2/src/features/rulebook/RetireBlock.tsx
git commit -m "$(cat <<'EOF'
Restore three export sentences the app had paraphrased

"Shown apart from" describes a layout; "counted separately from" says the
count did not move, which is the invariant FailedBanner exists to enforce.
"This signs your work" is the clause that tells an abstractor the press is a
signature. The rulebook's refusal string had grown a trailing word.

A source-grep gate pins all three plus the PENDING banner, so a future tidy
cannot quietly reword them.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `Sign-off line N · label` on the completeness gap

**Files:**
- Create: `apps/web-v2/src/entities/signoff/SignoffLineTitle.tsx`
- Modify: `apps/web-v2/src/features/completeness/GapCard.tsx:64-69`
- Modify: `apps/web-v2/src/features/review/NoDisclosureCards.tsx:44`
- Modify: `apps/web-v2/src/shared/exportCopy.test.ts` (append one `CopyCheck`)
- Test: `apps/web-v2/src/shared/exportCopy.test.ts`

**Interfaces:**
- Consumes: `CompletenessGap.line_number: number` (added in Wave 2 per the index's contract list).
- Produces:

```tsx
export interface SignoffLineTitleProps {
  /** The line's number on the sheet the abstractor signed. */
  n: number;
  label: string;
  as?: "h2" | "h3";
  className?: string;
}
export function SignoffLineTitle(props: SignoffLineTitleProps): ReactElement;
```

- [ ] **Step 1: Write the failing test**

Append to `CHECKS` in `apps/web-v2/src/shared/exportCopy.test.ts`, before the closing `];`:

```ts
  {
    // The number is what ties a gap back to the sheet. Without it a reviewer
    // cannot find the line to amend, which is the only exit the card offers.
    file: "src/features/completeness/GapCard.tsx",
    must: ["<SignoffLineTitle n={gap.line_number} label={gap.line_label} as=\"h2\" />"],
    gone: ["<h2 className=\"text-md font-semibold\">{gap.line_label}</h2>"],
  },
  {
    file: "src/features/review/NoDisclosureCards.tsx",
    must: ["<SignoffLineTitle"],
    gone: ["Sign-off line {line.n} · {line.label}"],
  },
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=gates exportCopy
```

```
  - src/features/completeness/GapCard.tsx LOST: <SignoffLineTitle n={gap.line_number} label={gap.line_label} as="h2" />
  - src/features/completeness/GapCard.tsx STILL CARRIES: <h2 className="text-md font-semibold">{gap.line_label}</h2>
  - src/features/review/NoDisclosureCards.tsx LOST: <SignoffLineTitle
  - src/features/review/NoDisclosureCards.tsx STILL CARRIES: Sign-off line {line.n} · {line.label}
```

- [ ] **Step 3: Implement**

Create `apps/web-v2/src/entities/signoff/SignoffLineTitle.tsx`:

```tsx
import type { ReactElement } from "react";
import { cn } from "../../shared/ui/classNames";

/**
 * `Sign-off line 6 · Deed chain complete`.
 *
 * THE NUMBER IS THE ROUTE BACK. A gap card names a line the gate disputes, and
 * the only thing a reviewer can do about it is go and amend that line on the
 * sheet — which they cannot find from the label alone, because the labels are
 * long sentences and the sheet is thirteen of them. The completeness card used
 * to print the label by itself and offer close options that all lead to a line
 * it declined to identify.
 *
 * ONE COMPONENT BECAUSE THERE ARE TWO CALLERS AND THEY DRIFTED. Review's
 * no-disclosure cards already composed this exact string by hand; completeness
 * did not compose it at all. A second hand-rolled copy is how the first one
 * stops matching.
 *
 * `n` IS THE SERVER'S. Nothing here counts lines or infers a position from an
 * array index — the sheet's numbering is the product's, not the payload's.
 */
export interface SignoffLineTitleProps {
  /** The line's number on the sheet the abstractor signed. */
  n: number;
  label: string;
  as?: "h2" | "h3";
  className?: string;
}

export function SignoffLineTitle({
  n,
  label,
  as,
  className,
}: SignoffLineTitleProps): ReactElement {
  const Tag = as ?? "h3";
  return (
    <Tag className={cn("text-md font-semibold text-ink-primary", className)}>
      Sign-off line {n} · {label}
    </Tag>
  );
}
```

In `GapCard.tsx`, replace the header title element (import `SignoffLineTitle` from `../../entities/signoff/SignoffLineTitle`):

```tsx
      <CardHeader>
        <SignoffLineTitle n={gap.line_number} label={gap.line_label} as="h2" />
        <Chip className="ml-auto" shape="pill" size="micro" tone={open ? "halt" : "settled"}>
          {open ? KIND_LABEL[gap.kind] : "Closed"}
        </Chip>
      </CardHeader>
```

In `NoDisclosureCards.tsx`, replace the hand-composed heading at the anchor line with `<SignoffLineTitle n={line.n} label={line.label} />`, keeping whatever element wrapper and classes surround it — pass extra classes through `className` rather than re-adding a heading element.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=gates exportCopy
```

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/entities/signoff/SignoffLineTitle.tsx apps/web-v2/src/features/completeness/GapCard.tsx apps/web-v2/src/features/review/NoDisclosureCards.tsx apps/web-v2/src/shared/exportCopy.test.ts
git commit -m "$(cat <<'EOF'
Name the sign-off line a completeness gap disputes

The gap card printed the line's label and not its number, so the close
options all pointed at a line the card declined to identify. Review already
composed the same string by hand; both now use one component so they cannot
disagree about it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: The gate rows name themselves, and a waiting stage says why

**Files:**
- Modify: `packages/mocks/src/workspace.ts` — the `pipelineFor` stage list (2026-07-30 anchor `:267-285`; Wave 2 rewrote it to eight stages)
- Modify: `apps/web-v2/src/shared/exportCopy.test.ts` (append one `CopyCheck`)
- Test: `apps/web-v2/src/shared/exportCopy.test.ts`

**Interfaces:**
- Consumes: `PipelineStage` from `@titlepipe/contract` — `{ id: string; label: string; detail: string; owner: "Automated" | "LLM agent" | "You"; phase: "done" | "running" | "halted" | "waiting" }`. Unchanged by this task.
- Produces: no new signature. The gate now covers a file outside `apps/web-v2`, so `CopyCheck.file` is resolved from the repo root for any path starting `packages/`.

- [ ] **Step 1: Write the failing test**

In `apps/web-v2/src/shared/exportCopy.test.ts`, change the path resolution inside the test body and append the entry.

Path resolution — replace the single `readFileSync` line with:

```ts
    const root = check.file.startsWith("packages/") ? join(process.cwd(), "..", "..") : process.cwd();
    const flat = readFileSync(join(root, check.file), "utf8").replace(/\s+/g, " ");
```

Appended `CHECKS` entry:

```ts
  {
    // A gate row that does not say it is a gate reads as a workflow step, and
    // the screen's own subtitle promises "two halts by design". A waiting row
    // that does not say WHY it has not run reads as a stall.
    file: "packages/mocks/src/workspace.ts",
    must: [
      "Completeness gate — checks the package against your sign-off",
      "Human QC gate — the run stops here for you",
      "Held — an incomplete package never reaches extraction.",
      "Waits until the completeness gate passes.",
    ],
    gone: ["waits on the gate", "waits on extraction"],
  },
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=gates exportCopy
```

```
  - packages/mocks/src/workspace.ts LOST: Completeness gate — checks the package against your sign-off
  - packages/mocks/src/workspace.ts LOST: Human QC gate — the run stops here for you
  - packages/mocks/src/workspace.ts LOST: Held — an incomplete package never reaches extraction.
  - packages/mocks/src/workspace.ts LOST: Waits until the completeness gate passes.
  - packages/mocks/src/workspace.ts STILL CARRIES: waits on the gate
  - packages/mocks/src/workspace.ts STILL CARRIES: waits on extraction
```

If Wave 2 already landed some of these verbatim, fewer lines appear. The task is complete only when the list is empty; record in the commit body which strings Wave 2 had already set.

- [ ] **Step 3: Implement**

In `packages/mocks/src/workspace.ts`, set these exact `label` and `detail` strings on the stages Wave 2 built. The gate rows take the em-dash clause — the export's convention for a row that is a gate rather than a step — and every `waiting` row states the condition it is waiting on rather than the thing it is waiting for:

- the completeness-gate stage: `label: "Completeness gate — checks the package against your sign-off"`
- the review stage: `label: "Human QC gate — the run stops here for you"`
- the extract stage: `detail: "Held — an incomplete package never reaches extraction."`
- the assemble stage: `detail: "Waits until the completeness gate passes."`

Every remaining `detail` becomes a sentence with a leading capital and a full stop, or a mono-style fact list with a middot and no stop — the export's two registers, never a lowercase fragment. Do not change any `phase`, `owner` or `id`: the phases are server state and this task is copy only.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=gates exportCopy
```

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add packages/mocks/src/workspace.ts apps/web-v2/src/shared/exportCopy.test.ts
git commit -m "$(cat <<'EOF'
Make the pipeline's gate rows name themselves and say why they wait

Processing promises "two halts by design" and then drew one row a reader
could recognise as a halt. The gate rows take the export's em-dash clause,
and the waiting rows state the condition ("Held — an incomplete package never
reaches extraction.") instead of the lowercase fragment "waits on the gate".

Phases, owners and ids are untouched — this is what the rows say, not what
the server decided.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: The audit log reads as sentences

**Files:**
- Create: `apps/web-v2/src/features/audit/actionLabels.ts`
- Create: `apps/web-v2/src/features/audit/actionLabels.test.ts`
- Modify: `apps/web-v2/src/features/audit/AuditRow.tsx:12-44`
- Test: `apps/web-v2/src/features/audit/actionLabels.test.ts`

**Interfaces:**
- Consumes: `AuditEntry` from `@titlepipe/contract` — `{ id: string; actor_id: string; action: string; entity: string; entity_id: string; at: string }`. `action` is `z.string()`, an open vocabulary on the wire.
- Produces:

```ts
export function actionPhrase(action: string): string | null;
export function entityRef(entity: string, entityId: string): string;
```

- [ ] **Step 1: Write the failing test**

```ts
// apps/web-v2/src/features/audit/actionLabels.test.ts
import { describe, expect, test } from "vitest";
import { actionPhrase, entityRef } from "./actionLabels";

/**
 * The audit screen's only job is being readable later. A row that says
 * `m.okafor · engine_seat_change` is a token nobody scans; the design's row
 * says what happened and keeps the token beside it.
 *
 * The vocabulary is CLOSED IN PRACTICE and OPEN ON THE WIRE — `action` is
 * `z.string()` — so the fall-through is the load-bearing case, not an edge:
 * a server action nobody mapped must degrade to the raw token, never to blank.
 */

const SERVED = [
  "engine_seat_change",
  "golden_correction",
  "escalation_resolved",
  "rule_confirmed",
  "field_confirmed",
] as const;

describe("the action vocabulary said out loud", () => {
  test("every action the mock serves has a phrase", () => {
    for (const action of SERVED) {
      expect(actionPhrase(action), `${action} has no phrase`).not.toBeNull();
    }
  });

  test("no two actions share a phrase", () => {
    const seen = new Map<string, string>();
    for (const action of SERVED) {
      const phrase = actionPhrase(action);
      if (phrase === null) continue;
      expect(seen.get(phrase), `${action} reads the same as ${seen.get(phrase)}`).toBeUndefined();
      seen.set(phrase, action);
    }
  });

  test("an unmapped action falls through to null, never to an empty phrase", () => {
    // The row prints the raw token alone in that case — being complete is the
    // whole value of a log.
    expect(actionPhrase("some_action_nobody_mapped")).toBeNull();
    expect(actionPhrase("")).toBeNull();
  });
});

describe("the entity reference is labelled, and its halves are separable", () => {
  test("an order is named as one", () => {
    expect(entityRef("orders", "4176034-1")).toBe("Order 4176034-1");
  });

  test("anything else keeps both halves with a separator", () => {
    expect(entityRef("engine_routing", "rt_B_hartford-ct_judgments_liens")).toBe(
      "engine_routing · rt_B_hartford-ct_judgments_liens",
    );
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=gates actionLabels
```

```
Error: Failed to resolve import "./actionLabels" from "src/features/audit/actionLabels.test.ts". Does the file exist?
```

- [ ] **Step 3: Implement**

Create `apps/web-v2/src/features/audit/actionLabels.ts`:

```ts
/**
 * The action vocabulary, said out loud.
 *
 * THE TOKEN IS EXPLAINED, NEVER REPLACED. `golden_correction` is what the
 * server wrote and the same string somebody greps its logs for, so the row
 * keeps it — beside a phrase, not instead of one. The screen used to print the
 * token alone, and a record nobody can read is a record nobody audits.
 *
 * AN UNMAPPED ACTION FALLS THROUGH TO THE TOKEN, never to blank. `action` is
 * `z.string()` on the wire, so a new server action must degrade to something
 * true rather than disappear from the log.
 *
 * THIS IS COPY OVER A SERVER VOCABULARY, NOT DERIVED STATE. Nothing here
 * decides what happened — the map only chooses how an already-recorded act
 * reads, so §4.3 is not in play.
 */
const PHRASE: Readonly<Record<string, string>> = {
  engine_seat_change: "Changed engine seat",
  golden_correction: "Corrected golden field",
  escalation_resolved: "Resolved escalation",
  rule_confirmed: "Confirmed rule",
  rule_retired: "Retired rule",
  field_confirmed: "Confirmed field",
  field_corrected: "Amended claim",
  field_excluded: "Excluded field",
};

export function actionPhrase(action: string): string | null {
  return PHRASE[action] ?? null;
}

/**
 * `orders` is the only entity a reader thinks of by name; everything else is a
 * table. Printing `{entity} {entity_id}` with a bare space ran the two halves
 * into one undifferentiated token.
 */
export function entityRef(entity: string, entityId: string): string {
  return entity === "orders" ? `Order ${entityId}` : `${entity} · ${entityId}`;
}
```

In `AuditRow.tsx`, replace the second and third paragraphs of the WHY comment and the row body. The comment's "THE ACTION NAME IS RENDERED VERBATIM" paragraph becomes:

```
 * THE ACTION IS SAID AND SHOWN. The phrase comes from `actionLabels.ts`; the
 * server's own token stays beside it in mono, because prettifying it away
 * would mean the string somebody greps for is not the string the screen shows.
 * An action with no phrase renders as the token alone.
```

Keep the existing `CONTRACT GAP` paragraph about the missing evidence field unchanged, and render:

```tsx
      <span className="min-w-100 flex-1">
        <span className="block text-base text-ink-primary">
          <span className="font-semibold">{entry.actor_id}</span>
          {actionPhrase(entry.action) === null ? null : ` · ${actionPhrase(entry.action)}`}{" "}
          <span className="font-mono text-xs text-ink-muted">{entry.action}</span>
        </span>
        <span className="mt-1 block text-xs text-ink-muted">
          {entityRef(entry.entity, entry.entity_id)}
        </span>
      </span>
```

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=gates actionLabels
```

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/features/audit/actionLabels.ts apps/web-v2/src/features/audit/actionLabels.test.ts apps/web-v2/src/features/audit/AuditRow.tsx
git commit -m "$(cat <<'EOF'
Say what an audit row records, and keep the token beside it

Every row read as a raw server token in mono, and the entity reference ran
its two halves together with a bare space. The row now leads with the actor,
says what happened, and keeps the greppable token as secondary text. An
action nobody mapped falls through to the token rather than rendering blank —
being complete is the log's whole value.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The escalation textareas get the export's placeholders, and `1 orders` stops

**Files:**
- Create: `apps/web-v2/src/shared/plural.ts`
- Create: `apps/web-v2/src/shared/plural.test.ts`
- Modify: `apps/web-v2/src/features/escalations/ClusterRail.tsx:60-64`
- Modify: `apps/web-v2/src/features/escalations/ResolveCard.tsx:61-68,97-105`
- Modify: `apps/web-v2/src/shared/exportCopy.test.ts` (append one `CopyCheck`)
- Test: `apps/web-v2/src/shared/plural.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `export function count(n: number, one: string, many?: string): string;`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web-v2/src/shared/plural.test.ts
import { describe, expect, test } from "vitest";
import { count } from "./plural";

/**
 * The escalation rail shipped `1 unanswered · 1 orders`, visible in the audit
 * screenshot. It is a small wrongness with a disproportionate cost: a screen
 * that cannot count to one is a screen a reader stops trusting the numbers on.
 */
describe("count", () => {
  test("one takes the singular", () => {
    expect(count(1, "order")).toBe("1 order");
  });

  test("zero and many take the plural", () => {
    expect(count(0, "order")).toBe("0 orders");
    expect(count(2, "order")).toBe("2 orders");
  });

  test("an irregular plural is given, never guessed", () => {
    expect(count(1, "entry", "entries")).toBe("1 entry");
    expect(count(3, "entry", "entries")).toBe("3 entries");
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=gates plural
```

```
Error: Failed to resolve import "./plural" from "src/shared/plural.test.ts". Does the file exist?
```

- [ ] **Step 3: Implement**

Create `apps/web-v2/src/shared/plural.ts`:

```ts
/**
 * `1 orders` is a bug a reader trusts less than the number beside it.
 *
 * ONE HELPER, NOT A TERNARY PER SITE. The same `N orders` / `N fields` /
 * `N pages` phrasing recurs on the queue, the overview, completeness and the
 * escalation rail. The rail shipped `1 unanswered · 1 orders`, which is what
 * per-site ternaries look like by the fourth site — fixed in one place and
 * still broken in three.
 *
 * ENGLISH ONLY, AND THE IRREGULAR PLURAL IS GIVEN RATHER THAN GUESSED. There
 * is no i18n layer here and inventing a rule table would be a second
 * vocabulary nothing validates.
 */
export function count(n: number, one: string, many?: string): string {
  return `${n} ${n === 1 ? one : (many ?? `${one}s`)}`;
}
```

In `ClusterRail.tsx`, import `count` from `../../shared/plural` and replace the composed note:

```tsx
            item(
              cluster,
              `${count(cluster.open.length, "unanswered", "unanswered")} · ${count(
                new Set(cluster.items.flatMap((e) => e.order_ids)).size,
                "order",
              )}`,
            ),
```

In `ResolveCard.tsx`, give both textareas the export's own placeholder strings:

```tsx
        <TextArea
          data-testid="ruling-input"
          placeholder="e.g. Lot 17 confirmed against the recorded plat, Book 144 Pg 38; microfilm degraded but plat is legible."
          value={ruling}
          onChange={(event) => setRuling(event.target.value)}
        />
```

```tsx
          <TextArea
            data-testid="draft-input"
            placeholder="One sentence — the rule as you'd say it out loud."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
```

Append to `CHECKS` in `exportCopy.test.ts`:

```ts
  {
    // Escalations is the one screen whose whole product claim is "write the
    // rule, one sentence", and it was the only screen with no placeholders.
    file: "src/features/escalations/ResolveCard.tsx",
    must: [
      "e.g. Lot 17 confirmed against the recorded plat, Book 144 Pg 38; microfilm degraded but plat is legible.",
      "One sentence — the rule as you'd say it out loud.",
    ],
  },
```

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=gates plural exportCopy
```

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/shared/plural.ts apps/web-v2/src/shared/plural.test.ts apps/web-v2/src/features/escalations/ClusterRail.tsx apps/web-v2/src/features/escalations/ResolveCard.tsx apps/web-v2/src/shared/exportCopy.test.ts
git commit -m "$(cat <<'EOF'
Show escalations what a ruling and a rule look like, and stop "1 orders"

Both textareas on the screen whose product claim is "write the rule, one
sentence" were empty boxes under an uppercase instruction; every other form
in the app carries a design-sourced placeholder. The cluster rail's count
line interpolated "orders" unconditionally — now through one helper, because
the same phrasing recurs on three other screens.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Remove the two lines the spec ruled off the screen

**Files:**
- Modify: `apps/web-v2/src/features/queue/NextOrderCard.tsx:102-105`
- Modify: `apps/web-v2/src/features/review/DecisionPanel.tsx:131`
- Modify: `apps/web-v2/src/shared/exportCopy.test.ts` (append two `CopyCheck`s)
- Modify: `docs/frontend/conflicts.md`
- Test: `apps/web-v2/src/shared/exportCopy.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. Both removals are deletions of leaf markup with no props or state behind them.

- [ ] **Step 1: Write the failing test**

First, confirm the removals are safe. Run:

```
cd apps/web-v2 && grep -rn "Keys:\|take it\|pipeline bug" e2e src --include=*.ts --include=*.tsx
```

Verified on 2026-07-30: the only `Keys:` hits are `entities/field/DecisionBar.tsx:60` (the dock legend the export DOES draw, which stays) and `features/queue/NextOrderCard.tsx:103`. The only `pipeline bug` hit is `DecisionPanel.tsx:131`. **No spec asserts either.** If the grep now returns an e2e hit, stop and raise it — a spec assertion outranks this ruling.

Then append to `CHECKS`:

```ts
  {
    // The export puts key hints nowhere on a screen; the `?` map is where a
    // chord is learned. Spec ruling 2026-07-30, recorded in conflicts.md.
    file: "src/features/queue/NextOrderCard.tsx",
    gone: ["Keys:"],
  },
  {
    // A bug-report line with no product rule and no endpoint behind it.
    file: "src/features/review/DecisionPanel.tsx",
    gone: ["Report pipeline bug"],
  },
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=gates exportCopy
```

```
  - src/features/queue/NextOrderCard.tsx STILL CARRIES: Keys:
  - src/features/review/DecisionPanel.tsx STILL CARRIES: Report pipeline bug
```

- [ ] **Step 3: Implement**

In `NextOrderCard.tsx`, delete the whole trailing paragraph:

```tsx
          <p className="mt-6 text-xs text-ink-secondary">
            Keys: <span className="font-mono">⏎</span> take it ·{" "}
            <span className="font-mono">P</span> pass
          </p>
```

The `useHotkeys` registrations stay — the keys still work, they are simply not advertised on the screen. Add to the component's WHY block, after the `passedRef` paragraph:

```
 * NO KEY HINT ON THE SCREEN. The chords are real and still bound; the export
 * prints key hints on no screen at all, and the `?` map is where a chord is
 * actually learned. A hint line here is a second place the binding can go
 * stale. Recorded in `conflicts.md` as a deliberate departure.
```

In `DecisionPanel.tsx`, delete the line `<p className="text-xs text-ink-muted">Report pipeline bug</p>` and amend the third paragraph of the component's WHY block — its closing sentence currently reads "The bug channel stays open for everyone, because 'this input is broken' is not a review decision." Replace that sentence with:

```
 * There is no bug-report affordance here: it had no product rule, no endpoint
 * and no counterpart anywhere in the export. Recorded in `conflicts.md`.
```

In `docs/frontend/conflicts.md`, under the `## Not conflicts — recorded so they are not "found" again` heading, add a new subsection immediately before it:

```markdown
## Deliberate departures — ruled 2026-07-30, not defects

### D6a — the queue's on-screen key hint is removed
**Design of record:** no key hints anywhere on a screen; the `?` map holds them.
**App before:** `Keys: ⏎ take it · P pass` under the next-up card.
**Ruling.** Removed. The chords stay bound; a printed hint beside a binding is a
second place the binding can go stale, and the export teaches chords in one place.
Verified before removal that no Playwright spec asserts the line.

### D6b — `Report pipeline bug` is removed from the decision card
**Design of record:** the export's 3,779 lines contain no bug-report affordance.
**App before:** a bare `Report pipeline bug` line under the decision actions.
**Ruling.** Removed. No product rule, no endpoint and nothing behind it — an
affordance that says an operation exists when it does not. `Pass — say why`
stays for the opposite reason: it has an endpoint, a `min(1)` refusal and
fourth-pass auto-escalation, and the export is simply stale.
```

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=gates exportCopy
```

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/features/queue/NextOrderCard.tsx apps/web-v2/src/features/review/DecisionPanel.tsx apps/web-v2/src/shared/exportCopy.test.ts docs/frontend/conflicts.md
git commit -m "$(cat <<'EOF'
Drop the queue key hint and the review bug-report line

Neither is drawn anywhere in the export and no spec asserts either. The
chords stay bound — the ? map is where a chord is learned, and a printed hint
is a second place the binding can go stale. "Report pipeline bug" had no
product rule and no endpoint behind it, so it advertised an operation that
does not exist. Both recorded in conflicts.md; Pass — say why stays, because
it has a server counterpart and the export is the stale artefact there.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: The three WHY comments that assert what the code does not hold

**Files:**
- Create: `apps/web-v2/src/shared/whyComments.test.ts`
- Create: `apps/web-v2/src/features/processing/StageRow.stories.tsx`
- Modify: `apps/web-v2/src/app/AppChrome.tsx:21-27`
- Modify: `apps/web-v2/src/app/OrderCounts.tsx:53-58`
- Modify: `apps/web-v2/src/features/processing/StageRow.tsx:75-83`
- Test: `apps/web-v2/src/shared/whyComments.test.ts`, `apps/web-v2/src/features/processing/StageRow.stories.tsx`

**Interfaces:**
- Consumes: `PipelineStage` from `@titlepipe/contract` (shape in Task 3).
- Produces: nothing exported. Both artefacts are gates.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web-v2/src/shared/whyComments.test.ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

/**
 * A comment stating an untested guarantee is what the next reader builds on.
 *
 * The audit found three: a flow comment that restated the splice while hiding
 * the conditional that produced a five-stage rail; "always visible, never
 * breakpoint-hidden" over counts the design hides below 1180px; and a claim
 * that the design sets all three stage owners identically — true of the
 * export's RENDER, false of its MARKUP, which carries filled owner pills.
 *
 * This gate is the cheap half. The expensive half is that each corrected claim
 * has a real test behind it: the rail's fixed positions (`sidebar.spec`), the
 * counts' breakpoint (Wave 4's own assertion), and `StageRow.stories.tsx`,
 * which proves the three owners render one identical label.
 */
const BANNED_ANYWHERE = [
  "Always visible, never breakpoint-hidden",
  "it is spliced in below rather than appended after",
  "The design sets all three owners in",
];

const REQUIRED: readonly { file: string; phrase: string }[] = [
  {
    file: "src/app/AppChrome.tsx",
    phrase: "THE FLOW IS SIX FIXED POSITIONS",
  },
  {
    file: "src/app/OrderCounts.tsx",
    phrase: "HIDDEN BELOW 1180px, AND THAT IS THE DESIGN'S CONCESSION",
  },
  {
    file: "src/features/processing/StageRow.tsx",
    phrase: "WHERE THE MARKUP AND THE RENDER DISAGREE, THE RENDER GOVERNS",
  },
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

test("no comment in src asserts an invariant the code does not hold", () => {
  const offenses: string[] = [];
  for (const file of walk(join(process.cwd(), "src"))) {
    if (file.endsWith("whyComments.test.ts")) continue;
    const flat = readFileSync(file, "utf8").replace(/\s+/g, " ");
    for (const phrase of BANNED_ANYWHERE) {
      if (flat.includes(phrase)) offenses.push(`${file} ASSERTS: ${phrase}`);
    }
  }
  expect(offenses).toEqual([]);
});

test("each corrected claim is stated where the audit found the false one", () => {
  const offenses: string[] = [];
  for (const { file, phrase } of REQUIRED) {
    const flat = readFileSync(join(process.cwd(), file), "utf8").replace(/\s+/g, " ");
    if (!flat.includes(phrase)) offenses.push(`${file} LOST: ${phrase}`);
  }
  expect(offenses).toEqual([]);
});
```

And the story that makes the StageRow claim true:

```tsx
// apps/web-v2/src/features/processing/StageRow.stories.tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import type { PipelineStage } from "@titlepipe/contract";
import { StageRow } from "./StageRow";

const meta = {
  title: "Processing/StageRow",
  component: StageRow,
  parameters: { layout: "padded" },
} satisfies Meta<typeof StageRow>;

export default meta;
type Story = StoryObj<typeof meta>;

const stage = (owner: PipelineStage["owner"], id: string): PipelineStage => ({
  id,
  label: `Stage ${id}`,
  detail: "Deskew, de-speckle, OCR · 64 pages",
  owner,
  phase: "waiting",
});

/**
 * The export's MARKUP carries filled owner pills — Automated grey, LLM agent
 * violet-tint, You solid violet — and its RENDER draws all three as one plain
 * uppercase label. The spec rules the render governs, so this asserts the
 * thing the WHY comment claims: the owner column ranks nobody.
 */
export const AllThreeOwnersRenderIdentically: Story = {
  args: { stage: stage("Automated", "a") },
  render: () => (
    <ul>
      <StageRow stage={stage("Automated", "a")} />
      <StageRow stage={stage("LLM agent", "b")} />
      <StageRow stage={stage("You", "c")} />
    </ul>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const owners = ["Automated", "LLM agent", "You"].map((o) => canvas.getByText(o));
    const [first] = owners;
    for (const owner of owners) {
      await expect(owner.className).toBe(first?.className);
    }
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=gates whyComments
```

```
  - …/src/app/OrderCounts.tsx ASSERTS: Always visible, never breakpoint-hidden
  - …/src/app/AppChrome.tsx ASSERTS: it is spliced in below rather than appended after
  - …/src/features/processing/StageRow.tsx ASSERTS: The design sets all three owners in
```

and, from the second test:

```
  - src/app/AppChrome.tsx LOST: THE FLOW IS SIX FIXED POSITIONS
  - src/app/OrderCounts.tsx LOST: HIDDEN BELOW 1180px, AND THAT IS THE DESIGN'S CONCESSION
  - src/features/processing/StageRow.tsx LOST: WHERE THE MARKUP AND THE RENDER DISAGREE, THE RENDER GOVERNS
```

- [ ] **Step 3: Implement**

`AppChrome.tsx` — replace the `FLOW` block comment entirely:

```tsx
/**
 * THE FLOW IS SIX FIXED POSITIONS. `n` is structural — a stage's number is its
 * place in the pipeline, not its place in whatever subset a screen happens to
 * render — so all six are built whether or not the URL names an order. Only
 * `done` and `badge` are order data.
 *
 * The failure this prevents is the one the audit found: Review was pushed only
 * when `orderId !== null`, so the rail read 1–5 with Delivered at 5 off an
 * order screen and 1–6 with Delivered at 6 on one. A number that moves with
 * where you are standing cannot teach anybody the pipeline, and it put this
 * file in direct contradiction with `LifecycleRail.tsx`, which states the
 * opposite rule about the same `n`.
 *
 * Review sits between Completeness and Delivered because a report is reviewed
 * before it is delivered.
 */
```

`OrderCounts.tsx` — replace the comment above the returned `<div>`:

```tsx
    // HIDDEN BELOW 1180px, AND THAT IS THE DESIGN'S CONCESSION, not an
    // oversight. Between 900 and 1180 the strip has to carry the order ref,
    // four tiles, the rotated stamp and the account chip; the tiles are the
    // part a reader can go and get, so they are what yields.
    //
    // The comment this replaces claimed "always visible, never
    // breakpoint-hidden" — an invariant this component never enforced and
    // Wave 4 explicitly reversed. A comment asserting an untrue guarantee is
    // worse than no comment, because it is what the next reader builds on.
```

`StageRow.tsx` — replace the owner-column comment:

```tsx
      {/*
       * THE OWNER IS A CAPTION, NOT A BADGE — and WHERE THE MARKUP AND THE
       * RENDER DISAGREE, THE RENDER GOVERNS (design spec, 2026-07-30). The
       * export's markup carries filled owner pills (Automated grey, LLM agent
       * violet-tint, You solid violet); its rendered artefact draws all three
       * as one plain uppercase label. "Make it look the same" means the
       * rendered artefact, so the pills are dead style.
       *
       * Ranking owners by colour would say a stage the machine runs is a
       * different KIND of thing from one you run, when the column only answers
       * "who touches this one". The row's phase already carries every state
       * signal here; a second coloured object at the right edge is what made
       * "waiting" read as a warning. `StageRow.stories.tsx` asserts the three
       * owners render an identical class list.
       */}
```

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=gates whyComments && pnpm --filter web-v2 test -- --project=storybook StageRow
```

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/shared/whyComments.test.ts apps/web-v2/src/features/processing/StageRow.stories.tsx apps/web-v2/src/app/AppChrome.tsx apps/web-v2/src/app/OrderCounts.tsx apps/web-v2/src/features/processing/StageRow.tsx
git commit -m "$(cat <<'EOF'
Correct three comments that asserted invariants the code does not hold

The flow comment restated the splice while hiding the conditional that made
Review's number move; the counts claimed they are never breakpoint-hidden,
which Wave 4 reversed; the stage-owner note claimed the design sets all three
owners identically, which is true of the export's render and false of its
markup. Each now states the rule that actually holds, and each has a test
behind it — a source gate for the claims, and a StageRow story proving the
three owners render one identical label.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: The Button size ladder gets the export's two document tiers

**Files:**
- Modify: `apps/web-v2/src/shared/ui/Button.tsx:46-53` (the `size` variant) and its WHY block
- Modify: `apps/web-v2/src/features/products/ProductList.tsx:48`
- Modify: `apps/web-v2/src/features/products/LineCatalogue.tsx:52`
- Modify: `apps/web-v2/src/features/delivered/ArtifactCard.tsx:47`
- Modify: `apps/web-v2/src/shared/ui/variants.test.ts`
- Test: `apps/web-v2/src/shared/ui/variants.test.ts`

**Interfaces:**
- Consumes: `buttonClasses` from `apps/web-v2/src/shared/ui/Button.tsx` — already exported as a pure `cva` config for exactly this kind of node assertion.
- Produces: `size` gains `"section"`. The full ladder becomes `"sm" | "section" | "md" | "lg" | "xl"`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web-v2/src/shared/ui/variants.test.ts`:

```ts
describe("the size ladder carries the export's two document tiers", () => {
  /**
   * The export draws a section-level action (`＋ New product`, the delivered
   * Download step) at 12px/8px×14px and a masthead action (`＋ New rule`) at
   * 13px/10px×15px. The app had one rung for both, so a section button was a
   * notch louder than drawn everywhere it appeared — and on the delivered
   * receipt the extra width is what pushed the subtitle onto a second line.
   */
  test("section is quieter than md and louder than sm", () => {
    expect(buttonClasses({ size: "section" })).toContain("text-sm");
    expect(buttonClasses({ size: "sm" })).toContain("text-xs");
    expect(buttonClasses({ size: "md" })).toContain("text-base");
  });

  test("section takes the design's 8px/14px padding on the 2px base", () => {
    const classes = buttonClasses({ size: "section" });
    expect(classes).toContain("px-7");
    expect(classes).toContain("py-4");
  });

  /**
   * `xl` is the full-width terminal-screen button — sign-in, session, the
   * delivered confirm. The design draws it 44px tall (13px padding, 14px
   * label, no border); the app drew 48px because `py-7` plus the solid fill's
   * 1.5px border overshoots.
   */
  test("xl takes 12px vertical padding, which lands the design's 44px", () => {
    expect(buttonClasses({ size: "xl" })).toContain("py-6");
    expect(buttonClasses({ size: "xl" })).not.toContain("py-7");
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=gates variants
```

Typecheck fails first — `"section"` is not assignable to the `size` variant:

```
src/shared/ui/variants.test.ts: Type '"section"' is not assignable to type '"sm" | "md" | "lg" | "xl" | null | undefined'.
```

and once that compiles, `xl takes 12px vertical padding` fails: `expected 'inline-flex … w-full px-8 py-7 text-lg rounded-7' to contain 'py-6'`.

- [ ] **Step 3: Implement**

In `Button.tsx`, replace the `size` variant block and its preceding comment:

```tsx
      size: {
        // Padding rounds to the 2px grid; the design's odd values (9/11/13px)
        // shift by 1px. Measured and accepted in tokens.md §7.
        //
        // THE LADDER IS THREE ROLES, NOT THREE GUESSES. `sm` is a control
        // inside a row. `section` is a section-level action on a document
        // screen (`＋ New product`, `＋ New line`, the delivered Download).
        // `md` is a masthead action (`＋ New rule`). The export draws section
        // and masthead one notch apart and the app had a single rung for both,
        // so every section button was as loud as a masthead one.
        sm: "px-5 py-3 text-xs rounded-5",
        section: "px-7 py-4 text-sm rounded-6",
        md: "px-8 py-5 text-base rounded-6",
        lg: "px-8 py-6 text-md rounded-7",
        // 12px padding, not 14px: the solid fill's 1.5px border is part of the
        // height, and `py-7` drew 48px where the design draws 44px.
        xl: "w-full px-8 py-6 text-lg rounded-7",
      },
```

In `ProductList.tsx`, the `＋ New product` button and `LineCatalogue.tsx`'s `＋ New line` button take `size="section"`. In `ArtifactCard.tsx` the Download button changes from `size="md"` to `size="section"`.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=gates variants
```

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/shared/ui/Button.tsx apps/web-v2/src/shared/ui/variants.test.ts apps/web-v2/src/features/products/ProductList.tsx apps/web-v2/src/features/products/LineCatalogue.tsx apps/web-v2/src/features/delivered/ArtifactCard.tsx
git commit -m "$(cat <<'EOF'
Give the button ladder the export's section tier, and land xl at 44px

The export draws a section-level action one notch quieter than a masthead
one; the app had a single rung, so "＋ New product" shouted as loudly as
"＋ New rule" and the delivered Download button was wide enough to push its
own subtitle onto a second line. xl drew 48px against the design's 44px
because the solid fill's border is part of the height.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: The sign-off defaults grid follows the measure

**Files:**
- Modify: `apps/web-v2/src/index.css` (append an `@utility` beside the existing `na-hatch` block, 2026-07-30 anchor `:87`)
- Modify: `apps/web-v2/src/features/clients/SignoffDefaults.tsx:56`
- Test: `apps/web-v2/e2e/smoke/routes.spec.ts` is not the right home; assert in the build instead — see Step 1.

**Interfaces:**
- Consumes: nothing.
- Produces: the utility class `grid-autofill-230`, usable anywhere a card grid must track the measure rather than a fixed column count.

- [ ] **Step 1: Write the failing test**

Tailwind v4 `@theme` namespaces are not uniform and a token can exist while its utility emits nothing (HANDOFF-UI §6). The check is therefore against the BUILT CSS, which is the only artefact that proves the class exists:

```
pnpm --filter web-v2 build && grep -c "grid-autofill-230" apps/web-v2/dist/assets/*.css
```

Expected before the change: `grep` exits 1 with `0`.

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 build && grep -c "grid-autofill-230" apps/web-v2/dist/assets/*.css
```

```
0
```

(`grep` exit code 1 — the utility does not exist.)

- [ ] **Step 3: Implement**

Append to `apps/web-v2/src/index.css`, after the `na-hatch` block:

```css
/*
 * The export's card grids track the MEASURE, not a column count:
 * `repeat(auto-fill, minmax(230px, 1fr))`. A fixed `sm:grid-cols-2` gave the
 * client sign-off defaults two ~650px chips at the 880px measure, stranding
 * each YES/N-A value ~500px from the label it belongs to. `check:rules` bars
 * the bracket form, so the track lives here as a named utility.
 */
@utility grid-autofill-230 {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
}
```

In `SignoffDefaults.tsx`, replace `<ul className="grid gap-4 sm:grid-cols-2">` with `<ul className="grid-autofill-230 gap-4">`.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 build && grep -c "grid-autofill-230" apps/web-v2/dist/assets/*.css
```

Expected: a count of at least 1.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/index.css apps/web-v2/src/features/clients/SignoffDefaults.tsx
git commit -m "$(cat <<'EOF'
Let the client sign-off defaults track the measure, not a column count

A fixed two-column grid drew ~650px chips at the 880px measure, stranding
each YES/N-A value half the card away from its label. The export's track is
auto-fill at 230px; check:rules bars the bracket form, so it lands as a named
utility and the emitted class is verified against the built CSS.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: The completeness gap card's uneven rhythm

**Files:**
- Modify: `apps/web-v2/src/features/completeness/GapCard.tsx:71-96`
- Test: `apps/web-v2/src/shared/exportCopy.test.ts` is a copy gate, not a spacing one — this task is verified by the screen capture in Task 13 and by the class assertions below.

**Interfaces:**
- Consumes: `SignoffLineTitle` from Task 2.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Append to `CHECKS` in `apps/web-v2/src/shared/exportCopy.test.ts` — the gate reads source, so it can pin a class list as precisely as a sentence, and this is the one density change whose whole point is that the gaps are NOT uniform:

```ts
  {
    // The card's rhythm is uneven on purpose: 8px between "You said" and "We
    // found" because they are one comparison, 14px before the provisional
    // block and before the options. A blanket gap-6 flattened the grouping,
    // so the claim/evidence pair stopped reading as a pair.
    file: "src/features/completeness/GapCard.tsx",
    must: ['<CardBody className="flex flex-col">', 'className="mt-7'],
    gone: ['<CardBody className="flex flex-col gap-6">'],
  },
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=gates exportCopy
```

```
  - src/features/completeness/GapCard.tsx LOST: <CardBody className="flex flex-col">
  - src/features/completeness/GapCard.tsx LOST: className="mt-7
  - src/features/completeness/GapCard.tsx STILL CARRIES: <CardBody className="flex flex-col gap-6">
```

- [ ] **Step 3: Implement**

Replace the `CardBody` and its children in `GapCard.tsx`. The blanket `gap-6` goes; each block states its own top margin, which is what makes the grouping legible:

```tsx
      <CardBody className="flex flex-col">
        <div className="flex gap-5">
          <Eyebrow variant="field" as="p" className="basis-42 shrink-0">
            You said
          </Eyebrow>
          <p className="text-base leading-body text-ink-primary">{gap.claim}</p>
        </div>

        {/* 8px — the claim and the evidence are one comparison, not two blocks. */}
        <div className="mt-4 flex gap-5">
          <Eyebrow variant="field" as="p" tone="halt" className="basis-42 shrink-0">
            We found
          </Eyebrow>
          <p className="text-base leading-body text-state-halt-ink">{gap.evidence}</p>
        </div>

        {open && gap.kind === "na_provisional" ? (
          <div className="mt-7 flex gap-5 rounded-7 border border-dashed border-state-attend bg-state-attend-surface px-6 py-5">
            <Eyebrow variant="field" as="p" tone="attend" className="basis-42 shrink-0">
              Provisional
            </Eyebrow>
            <p className="text-xs leading-open text-ink-secondary">{PROVISIONAL_NOTE}</p>
          </div>
        ) : null}

        <div className="mt-7">
          {open ? (
            <GapCloseOptions options={gap.close_options} onClose={onClose} />
          ) : (
            <GapClosedNote
              option={closure?.option ?? "Closed on the order"}
              note={closure?.note ?? gap.closed_note}
              by={closure?.by ?? gap.closed_by}
            />
          )}
        </div>
      </CardBody>
```

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=gates exportCopy
```

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/features/completeness/GapCard.tsx apps/web-v2/src/shared/exportCopy.test.ts
git commit -m "$(cat <<'EOF'
Restore the gap card's uneven rhythm

"You said" and "We found" are one comparison and sit 8px apart in the export;
the provisional block and the close options are separate acts and sit 14px
below. A blanket 12px gap made all four blocks equal, so the claim/evidence
pair stopped grouping against the things you can do about it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Gallery sample alignment and the overview board's proportions

**Files:**
- Modify: `apps/web-v2/src/features/gallery/StateCard.tsx:40`
- Modify: `apps/web-v2/src/features/overview/StageBoard.tsx:29`
- Modify: `apps/web-v2/src/features/overview/TallyStrip.tsx` (the tally cell's `px-8 py-6`)
- Modify: `apps/web-v2/src/shared/exportCopy.test.ts` (append one `CopyCheck`)
- Test: `apps/web-v2/src/shared/exportCopy.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Append to `CHECKS`:

```ts
  {
    // The no-value card legitimately holds six chips, not the export's four
    // (HANDOFF §4.2 — `pending` is a fifth thing, and `unsettled` is a sixth).
    // Its row therefore stretches, and centring floated the two short samples
    // beside it in ~85px of empty ground top and bottom.
    file: "src/features/gallery/StateCard.tsx",
    must: ["flex-1 items-start justify-center"],
    gone: ["flex-1 items-center justify-center"],
  },
  {
    file: "src/features/overview/StageBoard.tsx",
    must: ['className="grid grid-cols-7 items-start gap-4"'],
    gone: ['className="grid grid-cols-7 items-start gap-3"'],
  },
  {
    file: "src/features/overview/TallyStrip.tsx",
    must: ['"flex-1 basis-75 px-8 py-7"'],
    gone: ['"flex-1 basis-75 px-8 py-6"'],
  },
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=gates exportCopy
```

```
  - src/features/gallery/StateCard.tsx LOST: flex-1 items-start justify-center
  - src/features/gallery/StateCard.tsx STILL CARRIES: flex-1 items-center justify-center
  - src/features/overview/StageBoard.tsx LOST: className="grid grid-cols-7 items-start gap-4"
  - src/features/overview/StageBoard.tsx STILL CARRIES: className="grid grid-cols-7 items-start gap-3"
  - src/features/overview/TallyStrip.tsx LOST: "flex-1 basis-75 px-8 py-7"
  - src/features/overview/TallyStrip.tsx STILL CARRIES: "flex-1 basis-75 px-8 py-6"
```

- [ ] **Step 3: Implement**

`StateCard.tsx` — the sample well top-aligns:

```tsx
      <div className="flex min-h-59 flex-1 items-start justify-center bg-surface-app px-7 py-8">
        <div className="w-full">{children}</div>
      </div>
```

`StageBoard.tsx` — the board gap goes from 6px to 8px, the 2px-grid neighbour of the export's 9px:

```tsx
    <div className="grid grid-cols-7 items-start gap-4">
```

`TallyStrip.tsx` — the tally cell takes the export's 13px vertical padding, rounded up to the grid (tokens.md §7's accepted 1px shift):

```tsx
        "flex-1 basis-75 px-8 py-7",
```

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=gates exportCopy
```

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/features/gallery/StateCard.tsx apps/web-v2/src/features/overview/StageBoard.tsx apps/web-v2/src/features/overview/TallyStrip.tsx apps/web-v2/src/shared/exportCopy.test.ts
git commit -m "$(cat <<'EOF'
Top-align the gallery samples and open up the overview board

The no-value card correctly holds six states where the export drew four, so
its row is taller — and centring floated the two short samples beside it in
85px of empty ground. The board's seven columns sat 6px apart against the
export's 9px, and the tally cells were shallower than drawn.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Record every deliberate departure in `conflicts.md`

**Files:**
- Modify: `docs/frontend/conflicts.md` (the `## Deliberate departures` section Task 6 opened)
- Test: none — this is the record, and the gate is the review of it. Its correctness is checked by Step 3's cross-reference against the spec.

**Interfaces:**
- Consumes: the spec's "Decisions taken" list (`docs/superpowers/specs/2026-07-30-design-fidelity-design.md`) and the index's "Decisions already taken".
- Produces: nothing in code.

- [ ] **Step 1: Write the failing test**

There is no unit under test. The check is a cross-reference, run as a command whose output is the evidence:

```
grep -c "^### D" docs/frontend/conflicts.md
```

Expected before this task: `2` (D6a and D6b, added in Task 6).

- [ ] **Step 2: Run it — Expected: FAIL**

```
grep -c "^### D" docs/frontend/conflicts.md
```

```
2
```

The five departures the spec ruled on are not recorded. Task complete when this returns `7`.

- [ ] **Step 3: Implement**

Add five subsections to `## Deliberate departures — ruled 2026-07-30, not defects`, after D6b:

```markdown
### D3 — the `/escalations` rail door the export does not draw
**Design of record:** no Escalation Inbox door; `navGroups.Work` is Queue + Overview
only, and escalations are reached from the Overview board's escalated rows.
**Ruling.** The door stays. It is the only live carrier of two release-blocking
invariants — attention rides the doors as DOTS, never counts, and a door a role does
not hold is ABSENT, not dimmed (`e2e/invariants/sidebar.spec.ts:43,:65`). Revisit only
when another restricted door can carry the amber-dot and absence assertions.

### D6 — `Pass — say why` stays, and the export is the stale artefact
**Design of record:** no pass affordance anywhere in the 3,779-line export.
**Ruling.** Kept. Pass-with-reason is real server behaviour — an endpoint, a
`reason: min(1)` refusal, and fourth-pass auto-escalation. Removing it would delete a
rule the server enforces because a drawing predates it. The *hint line* advertising the
chord is a different question and was removed (D6a).

### D7 — ingest keeps two acts
**Design of record:** one button, one act — `Continue to sign-off →`.
**Ruling.** Two acts stay (`ingest.spec` #2): a package is uploaded, and then signed
for. The export's copy is adopted onto the press that actually advances the step —
press one is `Upload the package`, press two is `Continue to sign-off →` — so the
design's wording lands where its meaning is true.

### D8 — the Overview board raises its rail threshold instead of scrolling
**Design of record:** the board wrapped in `overflow-x:auto` with `min-width:1190px`.
**Ruling.** The board squeezes to its container and falls back to the rail at ~1190px.
The export's minimum inside a 764px container hid Escalated and Delivered behind a
scrollbar with no affordance (HANDOFF-UI §6) — a column that can never be reached is
worse than a column that is not drawn. The board is now only ever drawn at its
intended width.

### D1 — the order comes from the URL; there is no global current order
**Design of record:** the top strip carries full order context on every screen, gated
only on `showChrome`.
**Ruling.** Order identity stays URL-derived (`orderFromPath.ts`). The export's strip is
always populated because the export carries one global demo order; inventing a
remembered "current order" would fabricate context on screens that have none, and two
tabs on two orders is a normal way to work. Off an order screen the strip stays
brand-neutral, and the lifecycle rail stops printing `THIS ORDER` over stages it cannot
attach to an order.
```

Update the file's opening line — it currently reads "Sixteen." — to state the new total and note that the departures section is a different class of record from the conflicts above it: a conflict is something the design asks for that cannot be built; a departure is something built differently on purpose.

- [ ] **Step 4: Run — Expected: PASS**

```
grep -c "^### D" docs/frontend/conflicts.md
```

Expected: `7`.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add docs/frontend/conflicts.md
git commit -m "$(cat <<'EOF'
Record the five deliberate departures from the export

The escalations rail door, Pass — say why, ingest's two acts, the Overview
rail threshold and the URL-derived order are all places the app is knowingly
not what the export draws. Written down as departures rather than conflicts —
a conflict is something the design asks for that cannot be built; a departure
is something built differently on purpose — so the next audit reports them as
decisions rather than finding them again.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: The whole gate, the orphan sweep, and eighteen screen pairs

**Files:**
- Modify: none by default. Any file `knip` reports as orphaned by the reskin is deleted here, and any screen pair that does not match is raised as a finding rather than fixed silently.
- Test: the full suite plus the capture pass.

**Interfaces:**
- Consumes: `apps/web-v2/compare.mjs` with the click-path selector Wave 0 corrected — `node compare.mjs <DesignMenuLabel> <app-route> <out-dir>`.
- Produces: 36 PNGs in `../../shots`, one pair per screen.

- [ ] **Step 1: Write the failing test**

There is nothing new to write. The gate IS the test, and it is the one the wave has been deferring:

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 test:e2e && pnpm --filter web-v2 knip && pnpm typecheck
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 knip
```

Expected: `knip` names files this wave's removals orphaned. The candidates, from the deletions above: nothing from Tasks 1–7 by construction, but Task 6's two removals and Wave 4's screen rework together are what `knip` has not been run against as one set. Whatever it names, that is the failure — record the list before deleting anything.

- [ ] **Step 3: Implement**

Delete every file `knip` reports as unused, one at a time, re-running `knip` after each so a deletion that unblocks another is visible. Do **not** delete anything `knip` reports only because its sole consumer is a `.stories.tsx` — Wave 0 taught `knip` to stop counting stories as usage, so a story-only export is a genuine orphan, but confirm the component is not a documented gallery state before removing it (`features/gallery` is the sanctioned home for states no fixture reaches).

Then run the full gate in order and fix nothing beyond what it names:

```
pnpm --filter web-v2 typecheck
pnpm --filter web-v2 check:rules
pnpm --filter web-v2 lint
pnpm --filter web-v2 test
pnpm --filter web-v2 test:e2e
pnpm --filter web-v2 knip
pnpm typecheck
```

Then capture all eighteen pairs. Start both servers first and leave them running (`compare.mjs` starts nothing and must kill nothing): web-v2 on `http://localhost:5174` and the export on `http://localhost:4600`. The labels are the export's own — `navGroups` at `TitlePipe.dc.html:2937-2941` and `flowDef` at `:2919-2926`:

```
node compare.mjs Queue                 /queue                      ../../shots
node compare.mjs Overview              /overview                   ../../shots
node compare.mjs Upload                /ingest                     ../../shots
node compare.mjs Questions             /questions                  ../../shots
node compare.mjs Processing            /processing                 ../../shots
node compare.mjs Completeness          /completeness               ../../shots
node compare.mjs Review                /orders/ord_demo_1/review   ../../shots
node compare.mjs Delivered             /delivered                  ../../shots
node compare.mjs Rulebook              /rulebook                   ../../shots
node compare.mjs "Products & sign-off" /products                   ../../shots
node compare.mjs Clients               /clients                    ../../shots
node compare.mjs People                /people                     ../../shots
node compare.mjs Audit                 /audit                      ../../shots
node compare.mjs States                /gallery                    ../../shots
node compare.mjs Escalation            /escalations                ../../shots
node compare.mjs Profile               /profile                    ../../shots
node compare.mjs Session               /session                    ../../shots
node compare.mjs Signin                /signin                     ../../shots
```

The last four screens and Escalation are not reachable from the export's `<aside>`; they are reached through the account menu and the board's escalated rows, which is exactly the click path Wave 0 folded into `compare.mjs`. If `compare.mjs` warns `! no design menu button named "X" — captured the default screen` for any of them, the capture is worthless — stop and fix the click path rather than filing the pair.

Open all eighteen pairs and look at each. Record, per screen, either "matches" or the specific divergence, in the commit body. A divergence found here is a new finding for a follow-up plan, not something to fix inside this task — the wave's own changes are already through the gate, and reopening them here loses the boundary between what this wave did and what the next one must.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 test:e2e && pnpm --filter web-v2 knip && pnpm typecheck
```

Expected: all green, zero skips. The 2026-07-30 baseline was 297 tests and `check:rules` clean over 283 files; the count is higher now and every addition is this programme's, so any red is this work.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2 docs/frontend
git commit -m "$(cat <<'EOF'
Close the fidelity programme: full gate, orphan sweep, eighteen screen pairs

Ran typecheck, check:rules, lint, unit, e2e, knip and the root typecheck as
one set for the first time since the reskin, deleted what knip named orphaned,
and re-captured all eighteen design/app pairs with the corrected click path.
Per-screen verdicts below; a green suite is not evidence the UI is right, so
each pair was looked at.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## What this wave deliberately does not do

Named so the next reader does not find them again:

- **Copy that needs a contract field this programme did not add.** The overview `scope_note` variants, the products period phrase, the clients compare-matrix `load_bearing` chip, the profile capability sentences, the escalation `cluster_label`, the rulebook row's `changed_at`/`changed_by`, and the questions `Policy suggests YES` value each require a field on the wire. Wave 2 added the shapes the index lists; anything beyond that list is a `CONTRACT GAP` note, not a string this wave may invent. Emitting a value we cannot cite is the one rule the whole product is built around.
- **Shell and screen padding.** The upload gutter, the profile pane padding and the queue/overview page padding are `Screen`'s, set in Wave 0 and applied in Wave 4. Re-setting them per screen here would put the measure back in eleven places.
- **The delivered receipt's local wall-clock time and the audit's local zone.** Both slice the ISO string rather than parsing it, deliberately, because a delivered date is legally significant and a `Date` round-trip shifts it across a zone boundary. Localising needs a server-sent stamp or the recipient's zone, which is a contract request, not a copy fix.
- **Lifting the rulebook's refusal strings into one module.** A reuse proposal; reuse belongs to Waves 1 and 3.
