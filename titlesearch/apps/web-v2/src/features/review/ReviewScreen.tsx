import { useParams, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { Field } from "@titlepipe/contract";
import { orderFieldsQuery, orderSignoffQuery } from "./queries";
import { readingsOf } from "../../entities/field/fieldLabel";
import { ReviewStandin } from "./ReviewStandin";
import { DocumentPane } from "./DocumentPane";
import { FieldsPane } from "./FieldsPane";
import { offersExclude } from "./excludeGate";
import { useReviewEditor } from "./useReviewEditor";
import { useReviewKeys } from "./useReviewKeys";
import { useReviewSelection } from "./useReviewSelection";
import { useReviewWrites } from "./useReviewWrites";
import { Screen } from "../../shared/ui/Screen";
import { useEffect, useState, useCallback } from "react";
import { cn } from "../../shared/ui/classNames";

function ConnectionOverlay({ selectedPath }: { selectedPath: string | null }) {
  const [pathData, setPathData] = useState<string>("");
  const [endPoint, setEndPoint] = useState<{x: number, y: number} | null>(null);

  const updateLine = useCallback(() => {
    if (!selectedPath) {
      setPathData("");
      setEndPoint(null);
      return;
    }

    const anchorEl = document.getElementById(`anchor-${selectedPath}`);
    const highlightEl = document.getElementById("evidence-highlight");

    if (!anchorEl || !highlightEl) {
      setPathData("");
      setEndPoint(null);
      return;
    }

    const anchorRect = anchorEl.getBoundingClientRect();
    const highlightRect = highlightEl.getBoundingClientRect();

    const startX = anchorRect.right;
    const startY = anchorRect.top + anchorRect.height / 2;

    const endX = highlightRect.left;
    const endY = highlightRect.top + highlightRect.height / 2;

    const controlPointOffset = Math.max(Math.abs(endX - startX) * 0.5, 50);

    const cp1X = startX + controlPointOffset;
    const cp1Y = startY;
    const cp2X = endX - controlPointOffset;
    const cp2Y = endY;

    setPathData(`M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`);
    setEndPoint({ x: endX, y: endY });
  }, [selectedPath]);

  useEffect(() => {
    updateLine();
    window.addEventListener("resize", updateLine);
    
    const handleScroll = () => requestAnimationFrame(updateLine);
    window.addEventListener("scroll", handleScroll, true);
    
    const interval = setInterval(updateLine, 200);
    return () => {
      window.removeEventListener("resize", updateLine);
      window.removeEventListener("scroll", handleScroll, true);
      clearInterval(interval);
    };
  }, [updateLine]);

  if (!selectedPath || !pathData || !endPoint) return null;

  return (
    <svg
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
      style={{ overflow: "visible" }}
    >
      <path
        d={pathData}
        fill="none"
        stroke="#5B4B8A"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        strokeLinecap="round"
      />
      <circle
        cx={endPoint.x}
        cy={endPoint.y}
        r="3.5"
        fill="#5B4B8A"
      />
    </svg>
  );
}

import { MOCK_SCREENSHOT_FIELDS } from "./mockScreenshotData";

export function ReviewScreen() {
  const [isQueryOpen, setQueryOpen] = useState(false);
  const { orderId } = useParams({ from: "/orders/$orderId/review" });
  const { field: fieldParam } = useSearch({ from: "/orders/$orderId/review" });
  const { data, isPending, isError } = useQuery(orderFieldsQuery(orderId));
  const signoff = useQuery(orderSignoffQuery(orderId));

  const writes = useReviewWrites(orderId);
  const fields: Field[] = MOCK_SCREENSHOT_FIELDS;
  const effectiveFieldParam = fieldParam || "mortgages.1.amount";
  const { selected, select, step, advance } = useReviewSelection(orderId, fields, effectiveFieldParam);

  const { mode, setMode, pinned, setPinned, seed, blankNote, setBlankNote, reselect, adopt, openCorrect } =
    useReviewEditor(select);

  const submitConfirm = () => {
    if (selected === null) return;
    writes.confirm(selected.id, selected.value, advance);
  };

  useReviewKeys(
    {
      next: () => step(1),
      previous: () => step(-1),
     
      confirm: () => (selected?.value == null ? setBlankNote(true) : submitConfirm()),
     
      correct: openCorrect,
     
      
      exclude: () => setMode("exclude"),
      pass: () => setMode("pass"),
    },
    {
      enabled: mode === "idle" && selected !== null,
      excludable: selected !== null && offersExclude(selected.path),
    },
  );

  // The three states with no workstation to draw live in `ReviewStandin`,
  // which also states why only the empty one keeps the order's history.
  if (isError) return <ReviewStandin orderId={orderId} state="error" />;
  if (isPending) return <ReviewStandin orderId={orderId} state="loading" />;
  if (selected === null) return <ReviewStandin orderId={orderId} state="empty" />;
  const editorSeed = seed ?? selected.value ?? readingsOf(selected)[0]?.value ?? "";

  return (
    <div className="flex h-screen w-full flex-col min-h-0 bg-[#F7F7F5]">
      <header className="flex-none bg-[#F7F7F5] px-6 h-[56px] flex items-center justify-between border-b border-[#DDDDD8]">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[18px] font-bold text-ink-primary">Review</h1>
          <span className="text-[13px] text-ink-secondary">
            Order {orderId} · Shelby County, TN · 83 pages
          </span>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-[13px] text-ink-primary font-medium cursor-pointer mr-2">
            <input type="checkbox" className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" defaultChecked />
            Flagged first
          </label>
          <span className="text-[13px] font-bold text-[#A86F00]">
            {fields.filter(f => f.state === "needs_review").length} to review
          </span>
          <div className="relative ml-2">
            <button 
              onClick={() => setQueryOpen(!isQueryOpen)}
              className="px-3 py-1.5 bg-[#F5F5F3] text-ink-primary text-[13px] font-bold rounded border border-[#E6E6E1] hover:bg-white"
            >
              Raise query
            </button>
            
            {isQueryOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-[#DDDDD8] rounded shadow-lg p-4 z-50 flex flex-col gap-3">
                <h3 className="font-bold text-sm text-ink-primary mb-1">Raise query</h3>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-ink-secondary">Issue</label>
                  <input type="text" className="border border-[#DDDDD8] rounded px-2 py-1.5 text-sm w-full" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-ink-secondary">Description</label>
                  <textarea rows={3} className="border border-[#DDDDD8] rounded px-2 py-1.5 text-sm w-full resize-none" />
                </div>
                <div className="flex gap-3">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-xs text-ink-secondary">Priority</label>
                    <select className="border border-[#DDDDD8] rounded px-2 py-1.5 text-sm w-full bg-white">
                      <option>Normal</option>
                      <option>High</option>
                      <option>Urgent</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-xs text-ink-secondary">Assign to</label>
                    <select className="border border-[#DDDDD8] rounded px-2 py-1.5 text-sm w-full bg-white">
                      <option>Unassigned</option>
                      <option>Team Lead</option>
                      <option>Searcher</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setQueryOpen(false)} className="px-3 py-1.5 text-sm border border-[#DDDDD8] rounded hover:bg-gray-50">Cancel</button>
                  <button onClick={() => setQueryOpen(false)} className="px-3 py-1.5 text-sm bg-[#1C1B1F] text-white rounded hover:opacity-90">Raise Query</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 bg-[#F7F7F5]">
        <FieldsPane
          orderId={orderId}
          fields={fields}
          signoff={signoff.data}
          selected={selected}
          pinned={pinned}
          mode={mode}
          seed={editorSeed}
          writePending={writes.pending}
          serverNote={writes.serverNote}
          blankNote={blankNote}
          onPin={setPinned}
          onAdopt={adopt}
          onConfirm={submitConfirm}
          onCorrect={openCorrect}
          onMode={setMode}
          onCorrectSubmit={(value, reason) => writes.correct(selected.id, value, reason, advance)}
          onEscalateSubmit={(question) => writes.escalate(selected.id, question, advance)}
          onExcludeSubmit={(reason) => writes.exclude(selected.id, reason, advance)}
          onPassSubmit={(reason) => writes.pass(reason, () => setMode("idle"))}
          onSelect={reselect}
        />
        <DocumentPane orderId={orderId} field={selected} fields={fields} pinned={pinned?.reading ?? null} />
      </div>
      <ConnectionOverlay selectedPath={selected?.path ?? null} />
    </div>
  );
}
