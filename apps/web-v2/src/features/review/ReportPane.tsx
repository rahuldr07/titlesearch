import type { Field } from "@titlepipe/contract";
import { CallBackSheet } from "./CallBackSheet";
import { SectionRail } from "./SectionRail";

/**
 * The draft sheet and its jump nav, together — the rail is only useful beside
 * the document it points into, never as a floating index somewhere else on
 * the screen. Split out of `ReviewScreen` to keep that file under the file's
 * own size limit, not because the two need independent reuse.
 */
export function ReportPane({
  fields,
  selectedPath,
  onSelect,
}: {
  fields: readonly Field[];
  selectedPath: string;
  onSelect: (path: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      <div className="min-w-0 flex-1">
        <CallBackSheet fields={fields} selectedPath={selectedPath} onSelect={onSelect} />
      </div>
      <div className="xl:w-76 xl:flex-none">
        <SectionRail fields={fields} />
      </div>
    </div>
  );
}
