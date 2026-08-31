import type { CreateOrderRequest } from "@titlepipe/contract";
import { Card, type BadgeProps } from "../../components/ui";
import { Dropzone } from "./Dropzone";
import { OrderConfig } from "./OrderConfig";
import { QuarantineGateway } from "./QuarantineGateway";
import { OpticalProfile } from "./OpticalProfile";
import { SignFooter } from "./SignFooter";
import type { useQuarantineScan } from "./useQuarantineScan";

/**
 * The intake card — the package on the left, the order on the right, one act
 * across the bottom. The quarantine checklist and optical profile render
 * inline under the file row; the pre-order scan serves them the moment a file
 * lands.
 */
export function IngestForm(props: {
  readonly values: CreateOrderRequest;
  readonly file: File | null;
  readonly scan: ReturnType<typeof useQuarantineScan>;
  readonly pending: boolean;
  readonly onValue: (key: keyof CreateOrderRequest, value: string) => void;
  readonly onFile: (file: File | null) => void;
  readonly onSign: () => void;
}) {
  const { scan } = props;
  const pill: { text: string; tone: BadgeProps["tone"] } = scan.ready
    ? { text: "Quarantine Clear", tone: "settled" }
    : scan.done
      ? { text: "Quarantine Halted", tone: "halt" }
      : { text: "Scanning…", tone: "attend" };

  /* The button is gated only on the file — a press with client or product
     unpicked is refused by the server, which names what is missing. */
  const note =
    props.file === null
      ? "Drop the package to begin"
      : !scan.done
        ? "Waiting on quarantine"
        : scan.ready &&
            (props.values.client_id === "" || props.values.product === "")
          ? "Pick client and product"
          : null;

  return (
    <Card padding="none">
      <div className="grid grid-cols-2 items-start">
        <div className="flex flex-col gap-8 border-r border-line-subtle p-12">
          <h2 className="text-label font-bold leading-flat text-ink-faint">
            Package Document
          </h2>
          <Dropzone file={props.file} pill={pill} onFile={props.onFile} />

          {props.file !== null && scan.data !== null && (
            <QuarantineGateway
              rows={scan.rows}
              /* The digest is data; the sentence beside it is the de-dup
                 step's own verdict — quoted, never composed here. */
              sha={
                scan.done
                  ? {
                      digest: scan.data.sha256,
                      note: scan.data.steps.at(-1)?.detail ?? null,
                    }
                  : null
              }
              duplicateOf={scan.done ? scan.data.duplicate_of : null}
            />
          )}

          {props.file !== null && scan.ready && scan.data !== null && (
            <OpticalProfile optical={scan.data.optical} />
          )}
        </div>

        <div className="flex flex-col gap-8 p-12">
          <h2 className="text-label font-bold leading-flat text-ink-faint">
            Order Configuration
          </h2>
          <OrderConfig
            values={props.values}
            onValue={props.onValue}
            resolved={scan.ready ? (scan.data?.resolved ?? null) : null}
          />
        </div>
      </div>

      <SignFooter
        note={note}
        hasFile={props.file !== null}
        pending={props.pending}
        onSign={props.onSign}
      />
    </Card>
  );
}
