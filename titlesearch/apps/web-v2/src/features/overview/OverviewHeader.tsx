import { ScreenHeading } from "../../shared/ui/ScreenHeading";
import { ToggleGroup, Toggle } from "../../shared/ui/ToggleGroup";

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
 *
 * They ride in `ScreenHeading`'s `actions` slot, which pins them to the HEADING
 * ROW. Bottom-aligned against the whole block — as this drew them — the chips
 * sank further from the title the longer the scope note ran, and the scope note
 * is server text of unbounded length. At two long sentences the layout control
 * read as belonging to the paragraph it happened to end beside.
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
    <ScreenHeading
      eyebrow="Overview"
      /*
       * THE SIGNATURE ITALIC, on the word the screen is an argument about. The
       * mockup emphasises the CLOSING phrase of a heading — `to you.`,
       * `overrides` — and here that phrase is one verb: the columns are orders
       * that SIT, not orders that queue, and the lede spends two sentences
       * saying that stopped is the design rather than a backlog. Emphasising
       * "order" or "every" instead would decorate an arbitrary word; the verb is
       * the claim.
       */
      title={
        <>
          Where every order <em>sits</em>
        </>
      }
      lede={
        <>
          <p>
            One column per stage. The machine advances exactly one of them —
            every other column is an order stopped on a person, which is the
            design, not a backlog.
          </p>
          {/* Its own line, as the design sets it. The scope note answers a
              different question from the sentence above — "whose orders are
              these", not "what am I looking at" — and running the two together
              buries the one figure-changing caveat on the screen mid-paragraph. */}
          <p>{scopeNote}</p>
        </>
      }
      actions={
        narrow ? (
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
        )
      }
    />
  );
}
