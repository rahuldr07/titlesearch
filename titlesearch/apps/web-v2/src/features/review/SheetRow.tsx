import type { Field } from "@titlepipe/contract";
import {
  fieldLabel,
  isExcluded,
} from "../../entities/field/fieldLabel";
import { FieldValue } from "../../entities/field/FieldValue";
import { cn } from "../../shared/ui/classNames";

export function SheetRow({
  field,
  selected,
  onSelect,
  isLast,
  onConfirm,
  onMode,
}: {
  field: Field;
  selected: boolean;
  onSelect: () => void;
  isLast?: boolean;
  onConfirm?: () => void;
  onMode?: (m: string) => void;
}) {
  const shipsAsNotAvailable =
    field.value === null && field.na_reason !== null && !isExcluded(field);
  
  const isNeedsReview = field.state === "needs_review";
  const isError = isNeedsReview && (shipsAsNotAvailable || field.na_reason !== null);
  const isWarning = isNeedsReview && !isError;
  
  // Is this a standalone decision block (like Party Identity)?
  // We can guess if it has no value and is asking a question that requires buttons.
  const isDecisionBlock = isNeedsReview && field.value === null && !shipsAsNotAvailable && field.asking;

  if (isDecisionBlock) {
    return (
      <div 
        data-testid={`row-${field.path}`}
        onClick={onSelect}
        className={cn(
          "my-4 p-4 border rounded flex flex-col gap-3 cursor-pointer",
          selected ? "bg-[#FFF9F2]" : "bg-[#FDFCFB]",
          isWarning ? "border-[#B07A1E]" : "border-line-subtle"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-[#B07A1E] font-bold">◆</span>
          <span className="text-[13px] font-bold uppercase text-[#B07A1E] tracking-wider">{fieldLabel(field.path)} — VERIFICATION REQUIRED</span>
        </div>
        <p className="text-[13px] text-ink-primary leading-relaxed">{field.why || field.asking}</p>
        <div className="flex items-center gap-3 mt-2">
          <button onClick={(e) => { e.stopPropagation(); onConfirm?.(); }} className="bg-[#1C1B1F] text-white px-4 py-2 text-sm font-semibold rounded hover:opacity-90">
            Include as chain party
          </button>
          <button onClick={(e) => { e.stopPropagation(); onMode?.("exclude"); }} className="bg-transparent text-[#1C1B1F] px-4 py-2 text-sm font-semibold rounded border border-[#1C1B1F] hover:bg-black/5">
            Exclude + note, count 00
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={`row-${field.path}`}
      onClick={onSelect}
      className={cn(
        "flex px-4 py-3 cursor-pointer hover:bg-black/5 transition-colors",
        !isLast && "border-b border-[#D1D1CD]",
        isWarning && "border border-[#E5CF98] bg-[#FFF9F2] -mt-px relative z-10",
        isError && "border border-[#B3261E] bg-[#FEF7F6] -mt-px relative z-10",
        selected && !isWarning && !isError && "bg-[#F0EBF9] outline outline-1 outline-[#5B4B8A] relative z-10"
      )}
    >
      {/* Label Column */}
      <div className="w-[145px] shrink-0 pt-0.5">
        <span className={cn(
          "text-[13px] font-semibold",
          isWarning || isError ? "text-ink-primary" : "text-ink-muted"
        )}>
          {fieldLabel(field.path)}
        </span>
      </div>

      {/* Value Column */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col">
            {shipsAsNotAvailable ? (
              <span className="font-bold text-[13px] text-ink-primary">Not Available</span>
            ) : (
              <span className="font-bold text-[13px] text-ink-primary">
                <FieldValue field={field} />
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2 shrink-0 relative group">
            {isWarning && <span className="text-[#B07A1E] text-xs">◆</span>}
            {isError && <span className="text-[#B3261E] text-xs">▲</span>}
            {!isNeedsReview && field.value !== null && <span className="text-[#2E6B4F] text-xs">✓</span>}
            
            {field.source_page && (
              <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 hidden group-hover:block bg-[#1C1B1F] text-white text-[11px] font-bold px-2 py-1 rounded whitespace-nowrap shadow-sm z-50 pointer-events-none">
                pg {field.source_page}
                <div className="absolute top-1/2 -translate-y-1/2 -right-1 border-[4px] border-transparent border-l-[#1C1B1F]"></div>
              </div>
            )}
          </div>
        </div>

        {/* Inline Error/Warning text */}
        {isNeedsReview && (field.asking || field.why) && (
          <div className={cn(
            "text-[12px] mt-1 font-medium",
            isWarning ? "text-[#B07A1E]" : "text-[#B3261E]"
          )}>
            {field.asking} {field.why?.split("·")[0]} 
            {field.why?.includes("·") && (
              <span className="text-[#5B4B8A] cursor-pointer hover:underline">
                · {field.why.split("·")[1]}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Anchor dot for SVG connection */}
      {selected && (
        <div 
          id={`anchor-${field.path}`} 
          className="absolute -right-[3px] top-1/2 -translate-y-1/2 w-[6px] h-[6px] rounded-full bg-[#5B4B8A]" 
        />
      )}
    </div>
  );
}
