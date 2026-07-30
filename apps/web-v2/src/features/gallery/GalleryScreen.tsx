import { GALLERY_STATES } from "./galleryStates";
import { StateCard } from "./StateCard";
import { StateSample } from "./StateSample";
import { NoValueSample } from "./NoValueSample";
import { VerdictSamples } from "./VerdictSamples";
import { Screen } from "../../shared/ui/Screen";
import { ScreenHeading } from "../../shared/ui/ScreenHeading";

/**
 * THE STATES GALLERY — every edge state the UI can be in, side by side.
 *
 * This screen exists because of how state regressions actually happen. Nobody
 * ships two states that look identical on purpose; they ship a tint change that
 * was correct in isolation and quietly made "gap closed" indistinguishable from
 * "gate passed" three screens away. Nothing catches that except seeing them
 * next to each other, which no real screen ever does — a real screen shows one
 * state at a time, by definition.
 *
 * So this is a WORKING SURFACE, not documentation. It renders the live
 * components against the live tokens; it has no fixtures of its own beyond the
 * words on the cards. When a token moves, this screen moves with it, and the
 * collision shows up here before it shows up in a delivered report.
 *
 * The subtitle says "has to stay visually distinct" rather than "is" for the
 * same reason: distinctness is a property that decays, and the sentence is an
 * instruction to whoever is looking, not a claim about the current state.
 *
 * It is deliberately UNGROUPED and unfiltered. Sorting by severity would put
 * the two halt cards together, which is the one arrangement that makes their
 * difference easy and their difference from the settled cards hard — the
 * opposite of the comparison worth making.
 *
 * THE MASTHEAD IS THE SHARED ONE, and on this screen more than any other it has
 * to be. A catalogue that drew its own kicker, heading and lede would be the one
 * screen whose chrome no longer matches what it documents — the drift it exists
 * to catch, arriving through its own frontispiece. It carries the hub link
 * (`ux.spec` #7) with it, which the three loose elements only had by habit.
 *
 * THE VERDICT SAMPLES COME FIRST, and they are the reason this screen earns its
 * keep rather than merely illustrating. They are the LIVE gate banner and the
 * LIVE pipeline button, which /completeness and /processing each used to expose
 * through a "local preview" toggle so their unreachable rendering could be seen
 * at all. A toggle on a production screen lets a person repaint a server verdict
 * (hard rule 3); a catalogue entry cannot, because there is no order on this
 * page to be lied about. The cards below them are descriptions of states; these
 * four are the states.
 *
 * THE GRID FOLLOWS THE CARD, NOT THE VIEWPORT — `repeat(auto-fill, minmax(320px,
 * 1fr))`, the export's own rule (:2211). Breakpoint columns forced three 241px
 * cards into a 756px content box at a 1024px viewport, 79px under the floor the
 * design sets; auto-fill drops to two and keeps the card legible.
 */
export function GalleryScreen() {
  return (
    <Screen measure="1120">
      <div className="flex flex-col gap-11">
        <ScreenHeading
          eyebrow="Reference"
          title="States, not just the happy path"
          lede="Every one of these has to stay visually distinct in production. This is the catalogue."
        />

        <div className="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-8">
          <VerdictSamples />

          {GALLERY_STATES.map((state) => (
            <StateCard key={state.id} tag={state.tag} title={state.title} desc={state.desc}>
              <StateSample accent={state.accent} badge={state.badge} body={state.body} />
            </StateCard>
          ))}

          <StateCard
            tag="Report"
            title="Six distinct no-value states"
            desc="They must never collapse into one grey dash."
            surface="panel"
          >
            <NoValueSample />
          </StateCard>
        </div>
      </div>
    </Screen>
  );
}
