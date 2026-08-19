import type { Field } from "@titlepipe/contract";
import { SECTION_HEADING, sectionAnchor, sectionsOf } from "./reportSections";
import { SheetRow } from "./SheetRow";
import { Card, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";


export function CallBackSheet({
  fields,
  selectedPath,
  onSelect,
  ...decisionProps
}: {
  fields: readonly Field[];
  selectedPath: string;
  onSelect: (path: string) => void;
  onConfirm?: () => void;
  onMode?: (m: string) => void;
}) {
  return (
    <section data-testid="call-back-sheet" className="flex flex-col">
      {sectionsOf(fields).map(([section, rows]) => {
        return (
          <div key={section} id={sectionAnchor(section)} className="scroll-mt-16 flex flex-col mb-8">
            <div className="flex items-baseline gap-3 py-1 mb-5">
              <span className="text-[13px] font-bold uppercase tracking-wider text-ink-primary">
                {SECTION_HEADING[section] ?? section.replaceAll("_", " ")}
              </span>
              <span className="text-[11px] text-[#A09D96]">pg {rows[0]?.source_page ?? 1}</span>
            </div>
            
            <div className="flex flex-col border border-[#D1D1CD] bg-white">
              {rows.map((field: Field, idx: number) => (
                <SheetRow
                  key={field.id}
                  field={field}
                  selected={field.path === selectedPath}
                  onSelect={() => onSelect(field.path)}
                  isLast={idx === rows.length - 1}
                  {...decisionProps}
                />
              ))}
            </div>

            {section === "judgments" && (
              <div className="mt-6 mb-2 border border-[#D6A936] bg-[#FFF9E8] p-4 pb-6">
                <div className="flex items-center gap-1.5">
                  <span className="text-[#9A6C00] text-[10px] leading-none">◆</span>
                  <span className="text-[#9A6C00] font-bold uppercase text-[11px] leading-none tracking-wide">PARTY IDENTITY — VERIFICATION REQUIRED</span>
                </div>
                <p className="text-[13px] text-ink-primary mt-4">
                  Judgment 26-J-04412 indexed to “John A.&nbsp;&nbsp;Smith.” Owner of record is “John B.&nbsp;&nbsp;Smith.” No matching address or identifier found.
                </p>
                <div className="flex gap-4 mt-5">
                  <button className="bg-[#1C1B1F] text-white px-3.5 py-1.5 text-[12px] font-bold rounded-[2px] border border-[#1C1B1F]">
                    Include as chain party
                  </button>
                  <button className="bg-transparent border border-[#CCCCCC] text-ink-primary px-3.5 py-1.5 text-[12px] font-bold rounded-[2px]">
                    Exclude + note, count 00
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
