import { GALLERY_STATES } from "./galleryStates";
import { StateCard } from "./StateCard";
import { StateSample } from "./StateSample";
import { NoValueSample } from "./NoValueSample";
import { ScreenTitle } from "../../app/ScreenTitle";

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
 */
export function GalleryScreen() {
  return (
    <div className="flex flex-col">
      <ScreenTitle>Reference</ScreenTitle>

      <h1 className="mt-2 text-3xl font-semibold text-ink-primary">
        States, not just the happy path
      </h1>
      <p className="mt-1 mb-11 text-md text-ink-secondary">
        Every one of these has to stay visually distinct in production. This is
        the catalogue.
      </p>

      <div className="grid max-w-560 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {GALLERY_STATES.map((state) => (
          <StateCard key={state.id} tag={state.tag} title={state.title} desc={state.desc}>
            <StateSample accent={state.accent} badge={state.badge} body={state.body} />
          </StateCard>
        ))}

        <StateCard
          tag="Report"
          title="Six distinct no-value states"
          desc="They must never collapse into one grey dash."
        >
          <NoValueSample />
        </StateCard>
      </div>
    </div>
  );
}
