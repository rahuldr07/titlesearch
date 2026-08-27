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
      <span className="text-label font-semibold uppercase leading-flat tracking-caps text-ink-faint">
        Queue
      </span>
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
