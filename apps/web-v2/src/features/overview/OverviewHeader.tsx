import { ToggleGroup, Toggle } from "../../shared/ui/ToggleGroup";
import { ScreenTitle } from "../../app/ScreenTitle";

export type OverviewView = "board" | "rail";

/**
 * The screen's thesis, stated before any number is shown.
 *
 * "Every other column is an order stopped on a person, which is the design, not
 * a backlog" is doing real work here. Without it, seven columns of waiting
 * orders read as a queue nobody is clearing, and the first instinct of anyone
 * who reads it that way is to start pushing people. The sentence is the
 * difference between a status board and a stick.
 *
 * The scope note follows immediately because "4 stopped" means nothing until
 * you know whether it is the shop or your corner of it — and it is the
 * SERVER'S sentence, because only the server knows what this caller was shown.
 *
 * The view chips DISAPPEAR when the window is too narrow to honour the choice,
 * and the reason takes their place. A control that silently does nothing is
 * worse than no control.
 */
export function OverviewHeader({
  view,
  onView,
  narrow,
  scopeNote,
}: {
  view: OverviewView;
  onView: (view: OverviewView) => void;
  narrow: boolean;
  scopeNote: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <ScreenTitle>Overview</ScreenTitle>
      <div className="flex flex-wrap items-end gap-9">
        <header className="min-w-150 flex-1">
          <h1 className="text-3xl font-semibold text-ink-primary">Where every order sits</h1>
          <p className="mt-1.5 max-w-285 text-base leading-body text-ink-secondary">
            One column per stage. The machine advances exactly one of them —
            every other column is an order stopped on a person, which is the
            design, not a backlog.
          </p>
          {/* Its own line, as the design sets it. The scope note answers a
              different question from the sentence above — "whose orders are
              these", not "what am I looking at" — and running the two together
              buries the one figure-changing caveat on the screen mid-paragraph. */}
          <p className="mt-1.5 max-w-285 text-base leading-body text-ink-secondary">
            {scopeNote}
          </p>
        </header>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {narrow ? (
            <span className="max-w-68 text-tiny leading-close text-ink-muted">
              Stacked for this width — the seven-column board needs a wider window.
            </span>
          ) : (
            <ToggleGroup
              aria-label="Overview layout"
              value={[view]}
              onValueChange={(next) => {
                const picked = next.at(0);
                if (picked === "board" || picked === "rail") onView(picked);
              }}
            >
              <Toggle value="board" className="rounded-6 px-7 py-4 text-sm">Board</Toggle>
              <Toggle value="rail" className="rounded-6 px-7 py-4 text-sm">Rail</Toggle>
            </ToggleGroup>
          )}
        </div>
      </div>
    </div>
  );
}
