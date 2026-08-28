import { Link } from "@tanstack/react-router";
import type { Order } from "@titlepipe/contract";
import { Card } from "../../components/ui";
import { SpotlightOrder } from "./SpotlightOrder";

/**

 * THE ACTIVE SPOTLIGHT — the three answers the queue can give, and nothing about how a

 * served order is drawn. That is `SpotlightOrder`.

 */
export function Spotlight(props: {
  readonly order: Order | null;
  readonly pending: boolean;
}) {
  if (props.pending) {
    return (
      <Card>
        <p className="text-meta leading-body text-ink-muted">
          Asking the queue what is next…
        </p>
      </Card>
    );
  }

  /*
   * NULL IS THE SERVER'S ANSWER. `QueueNextResponse.order` is nullable, and
   * nothing being served is a statement about the queue rather than a failure
   * to load one. The card stays, so the reader can tell "nothing for you" from
   * "this screen has no spotlight".
   */
  if (props.order === null) {
    return (
      <Card>
        <div className="flex flex-col gap-5">
          <span className="text-label font-semibold leading-flat text-ink-faint">
            Active spotlight
          </span>
          <p className="text-meta leading-body text-ink-secondary">
            The queue has nothing for this seat right now. There is no list to look
            through — work arrives by being served.
          </p>
          <Link
            to="/queue"
            className="tp-state w-fit text-meta font-semibold leading-close text-action underline-offset-4 hover:underline"
          >
            The queue
          </Link>
        </div>
      </Card>
    );
  }

  return <SpotlightOrder order={props.order} />;
}
