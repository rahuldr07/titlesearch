import { Link } from "@tanstack/react-router";
import type { Order } from "@titlepipe/contract";
import { Card } from "../../components/ui";
import { SpotlightOrder } from "./SpotlightOrder";

/** The three answers the queue can give. `SpotlightOrder` draws the served one. */
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

  // Null is the server's answer, not a failed load, so the card stays.
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
