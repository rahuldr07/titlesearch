import { useRead } from "../../app/useRead";
import { composition } from "../../shared/releaseQueries";
import { QueryState } from "../../entities/state/QueryState";
import { Card, Empty } from "../../components/ui";
import { GatePanel } from "./GatePanel";
import { ManifestNav } from "./ManifestNav";
import { ManifestSheet } from "./ManifestSheet";
import { ReleaseAct } from "./ReleaseAct";

/**
 * SCREEN — THE RELEASE COMPILER.
 *
 * A 320px index rail (manifest blocks above, the server's gate verdicts below),
 * the composed report as paper in the middle, and the signed act at the foot.
 *
 * Every number, verdict and sentence on it comes off one read. Nothing is
 * counted, compared or inferred here: `releasable` is the server's, each gate's
 * `passed` is the server's, and `blocked_reason` is the server's sentence.
 */
export function ReleaseScreen(props: { readonly orderId: string }) {
  const composed = useRead(composition(props.orderId));

  return (
    <div
      data-testid="release-screen"
      className="tp-screen-enter flex h-full min-h-0 w-full overflow-hidden"
    >
      <QueryState query={composed} of="this order's composed report">
        {(data) =>
          data.blocks.length === 0 ? (
            <div className="w-full p-14">
              <Card>
                <Empty
                  title="Nothing composed yet"
                  reason="The server has assembled no manifest blocks for this order. There is no report to release, and an empty sheet is not a deliverable."
                />
              </Card>
            </div>
          ) : (
            <>
              <div className="flex w-160 shrink-0 flex-col border-r border-line-strong bg-surface-panel">
                <ManifestNav blocks={data.blocks} />
                <GatePanel gates={data.gates} />
              </div>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {/* A scrolling pane must be keyboard-reachable and named.
                    `items-start` because the default stretch pins the sheet to
                    the viewport's height and the last blocks render off the
                    paper — a deliverable that runs past its own page. */}
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Composed report"
                  className="tp-state flex min-h-0 flex-1 items-start justify-center overflow-y-auto bg-surface-app p-16"
                >
                  <ManifestSheet composed={data} />
                </div>

                <div className="shrink-0 border-t border-line-strong bg-surface-panel p-12">
                  <ReleaseAct composed={data} />
                </div>
              </div>
            </>
          )
        }
      </QueryState>
    </div>
  );
}
