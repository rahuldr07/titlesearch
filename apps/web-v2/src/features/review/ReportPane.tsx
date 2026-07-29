import type { Field, OrderSignoffLine } from "@titlepipe/contract";
import { CallBackSheet } from "./CallBackSheet";
import { NoDisclosureCards } from "./NoDisclosureCards";
import { SectionRail } from "./SectionRail";

/**
 * The draft sheet and its jump nav, together — the rail is only useful beside
 * the document it points into, never as a floating index somewhere else on
 * the screen. Split out of `ReviewScreen` to keep that file under the file's
 * own size limit, not because the two need independent reuse.
 *
 * THE DISCLOSURE CARDS SIT ABOVE THE SHEET, NOT INSIDE IT (design `:920-961`,
 * moved here per the 2026-07-28 revision, HANDOFF §11). A NO at intake is
 * read before the assembled report, the same order a reviewer would want to
 * meet it in: the gap, then the document it affects.
 */
export function ReportPane({
  fields,
  signoffLines,
  selectedPath,
  onSelect,
}: {
  fields: readonly Field[];
  signoffLines: readonly OrderSignoffLine[];
  selectedPath: string;
  onSelect: (path: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <NoDisclosureCards lines={signoffLines} />
        <CallBackSheet fields={fields} selectedPath={selectedPath} onSelect={onSelect} />
      </div>
      <div className="xl:w-76 xl:flex-none">
        <SectionRail fields={fields} />
      </div>
    </div>
  );
}
