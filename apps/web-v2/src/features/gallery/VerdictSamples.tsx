import { GateClosedBanner, GateOpenBanner } from "../../entities/order/GateBanner";
import { GateCallToAction } from "../../entities/order/GateCallToAction";
import { StateCard } from "./StateCard";

/**
 * The gate's two verdicts, on both surfaces that draw them.
 *
 * RULE: a server verdict is rendered, never repainted. FAILURE PREVENTED: until
 * now /completeness and /processing each carried a "local preview" toggle, put
 * there because the passed rendering is unreachable on every fixture. A toggle
 * on a production screen lets a reviewer flip the banner to "Package complete"
 * above three open gaps with live close buttons — the screen asserting the
 * opposite of what it shows. The unreachable rendering belongs HERE, where the
 * page is labelled a catalogue and no order is on screen to be lied about.
 *
 * THEY ARE THE LIVE COMPONENTS, promoted to `entities/order` so this folder can
 * import them without a cross-feature edge. A redrawn copy would make the
 * catalogue agree with itself and with nothing else, which is the one failure
 * the gallery cannot afford.
 *
 * THE TWO PAIRS ARE KEPT ADJACENT because the check worth making is that a
 * halted run and an open gate read as the same event twice — the run's button
 * and the gate's banner are the two things a person sees when the pipeline
 * stops, on two screens, minutes apart.
 */

/**
 * The catalogue's link target. The call to action is a LINK, and a catalogue
 * entry whose link goes nowhere is a sample of something the product does not
 * do — so it points at the order the mock actually serves, the same one
 * /processing and /completeness stand in with while those routes are not yet
 * order-scoped (see either feature's `queries.ts`).
 */
const SAMPLE_ORDER_ID = "ord_demo_1";

export function VerdictSamples() {
  return (
    <>
      <StateCard
        tag="Completeness"
        title="Gate open — the server's verdict"
        desc="What `gate_open: true` draws. The only verdict the demo fixture reaches."
      >
        <GateOpenBanner />
      </StateCard>

      <StateCard
        tag="Completeness"
        title="Gate closed — the server's verdict"
        desc="What `gate_open: false` draws. No fixture passes the gate, so this is its only home."
      >
        <GateClosedBanner />
      </StateCard>

      <StateCard
        tag="Pipeline"
        title="Run halted at the gate"
        desc="The closing call to action when `gate_halted` is true."
      >
        <GateCallToAction halted orderId={SAMPLE_ORDER_ID} />
      </StateCard>

      <StateCard
        tag="Pipeline"
        title="Run waiting on the reviewer"
        desc="The same button once the gate has passed — unreachable while the demo order is halted."
      >
        <GateCallToAction halted={false} orderId={SAMPLE_ORDER_ID} />
      </StateCard>
    </>
  );
}
