import { Card, Empty } from "../../components/ui";

/**
 * THE QUEUE'S HEADER AND ITS THREE NON-ORDER STATES.
 *
 * Split out of `QueueScreen` because §6 caps a file at 150 lines and "a
 * component is missing" was the right diagnosis: the screen's job is the served
 * order and the two acts on it, and everything here is what it renders when
 * there is no order to act on.
 *
 * ══ THREE STATES, AND THEY MUST NOT COLLAPSE INTO ONE ══════════════════════
 *
 * PENDING is "we have not asked yet or are still asking". ERROR is "the ask
 * failed". EMPTY is "the server answered, and the answer was nothing." A single
 * blank pane for all three is the defect `components/ui/empty.tsx` was written
 * against — it "leaves the reader unable to tell a filter that matched nothing
 * from a queue that is genuinely clear from a fetch that failed quietly."
 *
 * On this screen the distinction is sharper than usual, because a reviewer with
 * no work and a reviewer whose queue is broken should do opposite things.
 */
export function QueueHeader() {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-title font-bold leading-tight text-ink-primary">
        Next for you
      </h1>
      {/*
       * THE SCREEN SAYS WHAT IT IS. Not decoration: a reviewer who expects the
       * design's browsable list and is handed one order should be told that is
       * the design, rather than left assuming the list failed to load.
       */}
      <p className="max-w-240 text-meta leading-body text-ink-secondary">
        The server chooses. There is one order at a time and no way to pick a
        different one — pass with a reason and the next is served.
      </p>
    </header>
  );
}

export function QueueAsking() {
  return (
    <Card>
      <p className="text-meta leading-body text-ink-muted">Asking the queue…</p>
    </Card>
  );
}

/** The server's message, verbatim (`INVARIANTS:58-59`). Never reworded. */
export function QueueFailed(props: { readonly message: string }) {
  return (
    <Card>
      <p
        data-testid="queue-error"
        role="alert"
        className="text-meta leading-body text-state-halt"
      >
        {props.message}
      </p>
    </Card>
  );
}

/**
 * NULL IS AN ANSWER, NOT AN EMPTY LIST. `QueueNextResponse.order` is nullable
 * and the server saying "nothing" is a statement about the queue, not a filter
 * that matched nothing — so there is no Clear-search action here, because there
 * was never a search. `Empty` requires a `reason` for exactly this: the pane
 * has to say which kind of nothing it is.
 */
export function QueueEmpty() {
  return (
    <Card padding="none">
      <Empty
        title="Nothing queued for you"
        reason="The server has no next order for this seat. There is no list to look through — when work is ready it is served here."
      />
    </Card>
  );
}

/**
 * WHAT JUST LEFT, AND WHY IT IS ON THE SCREEN RATHER THAN ONLY IN A TOAST.
 *
 * A pass swaps one order for another in the same card, and those two orders
 * look alike: same layout, same fields, a different ref. Without a line naming
 * what was passed, the only evidence anything happened is that a number
 * changed — and a reviewer who was reading rather than watching has no way to
 * tell a successful pass from a screen that never moved.
 *
 * A toast fires too (`usePassOrder`), because that is the notification. This is
 * the RECORD, and it persists until the next act.
 *
 * It names the order and NOT the reason. The reason went to the server and
 * belongs to the next person who opens the order; echoing it back here would
 * make it look like something this browser kept.
 *
 * There is deliberately no count. `endpoints.ts:206-210`: pass counts and the
 * 4th-pass auto-escalation "never come back to the client", and a per-person
 * tally is banned by §4.5 regardless.
 */
export function PassedNote(props: { readonly orderRef: string }) {
  return (
    <p
      data-testid="passed-note"
      role="status"
      className="text-meta leading-close text-ink-secondary"
    >
      Recorded — you passed{" "}
      <span className="font-mono tabular-nums text-ink-primary">
        {props.orderRef}
      </span>
      . The server chose what is below.
    </p>
  );
}
