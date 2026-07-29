import type { Field, OrderSignoffLine } from "@titlepipe/contract";
import { type Pinned } from "./DecisionPanel";
import { DecisionColumn } from "./DecisionColumn";
import { DecisionDock } from "./DecisionDock";
import { FieldList } from "./FieldList";
import { FinalizeBar } from "./FinalizeBar";
import { ReportPane } from "./ReportPane";
import { type ReviewMode } from "./ReviewEditors";

interface FieldsColumnProps {
  fields: readonly Field[];
  signoffLines: readonly OrderSignoffLine[];
  selected: Field;
  pinned: Pinned | null;
  mode: ReviewMode;
  seed: string;
  passPending: boolean;
  serverNote: string | null;
  blankNote: boolean;
  onPin: (pinned: Pinned) => void;
  onAdopt: (value: string) => void;
  onConfirm: () => void;
  onCorrect: () => void;
  onMode: (mode: ReviewMode) => void;
  onCorrectSubmit: (value: string, reason: string) => void;
  onEscalateSubmit: (question: string) => void;
  onExcludeSubmit: (reason: string) => void;
  onPassSubmit: (reason: string) => void;
  onSelect: (path: string) => void;
}

/**
 * "RIGHT: FIELDS" — the design's own label (`:832`) for everything beside the
 * document: the decision queue, the finalize bar, and the draft report with
 * its disclosure cards. Split out of `ReviewScreen` to keep that file under
 * its own size limit; the two do not need independent reuse.
 */
export function FieldsColumn({
  fields,
  signoffLines,
  selected,
  pinned,
  mode,
  seed,
  passPending,
  serverNote,
  blankNote,
  onPin,
  onAdopt,
  onConfirm,
  onCorrect,
  onMode,
  onCorrectSubmit,
  onEscalateSubmit,
  onExcludeSubmit,
  onPassSubmit,
  onSelect,
}: FieldsColumnProps) {
  return (
    <div className="flex flex-col gap-6">
      <DecisionDock fields={fields} selectedPath={selected.path} />
      <DecisionColumn
        field={selected}
        pinned={pinned}
        mode={mode}
        seed={seed}
        machineValue={selected.value ?? ""}
        passPending={passPending}
        serverNote={serverNote}
        blankNote={blankNote}
        onPin={onPin}
        onAdopt={onAdopt}
        onConfirm={onConfirm}
        onCorrect={onCorrect}
        onMode={onMode}
        onCorrectSubmit={onCorrectSubmit}
        onEscalateSubmit={onEscalateSubmit}
        onExcludeSubmit={onExcludeSubmit}
        onPassSubmit={onPassSubmit}
      />

      <FieldList fields={fields} selectedPath={selected.path} onSelect={onSelect} />
      <FinalizeBar fields={fields} />
      <ReportPane
        fields={fields}
        signoffLines={signoffLines}
        selectedPath={selected.path}
        onSelect={onSelect}
      />
    </div>
  );
}
