import { useState } from "react";
import { useFlipSeat } from "./queries";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Button } from "../../shared/ui/Button";
import { TextField } from "../../shared/ui/TextField";

/**
 * Moving an engine into a production seat.
 *
 * REFUSED WITHOUT EVIDENCE, and the evidence is recorded alongside who
 * approved it (`leaderboard.spec` #3). A seat change alters what every future
 * order is read by; six months later the only thing that explains it is the
 * bench run someone pointed at.
 *
 * The confirm control stays DISABLED rather than absent here, because unlike a
 * refusal the reviewer can act on immediately, this one names its own remedy:
 * the empty field is directly above it.
 */
export function SeatFlip({
  jurisdiction,
  section,
  engineId,
}: {
  jurisdiction: string;
  section: string;
  engineId: string;
}) {
  const [seat, setSeat] = useState<"A" | "B" | null>(null);
  const [evidence, setEvidence] = useState("");
  const flip = useFlipSeat();

  return (
    <Card accent="attend">
      <CardHeader filled>
        <Eyebrow variant="section">
          Move {engineId} into a seat — {jurisdiction} · {section}
        </Eyebrow>
      </CardHeader>
      <CardBody className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-4">
          <Button
            size="sm"
            data-testid="flip-A"
            fill={seat === "A" ? "solid" : "outlined"}
            tone={seat === "A" ? "action" : "neutral"}
            onClick={() => setSeat("A")}
          >
            Seat A
          </Button>
          <Button
            size="sm"
            data-testid="flip-B"
            fill={seat === "B" ? "solid" : "outlined"}
            tone={seat === "B" ? "action" : "neutral"}
            onClick={() => setSeat("B")}
          >
            Seat B
          </Button>
        </div>

        <label className="flex flex-col gap-3">
          <Eyebrow variant="field">Evidence — a bench run someone can open</Eyebrow>
          <TextField
            data-testid="evidence-input"
            value={evidence}
            placeholder="bench://run-47"
            onChange={(e) => setEvidence(e.target.value)}
          />
        </label>

        <div>
          <Button
            size="sm"
            data-testid="confirm-flip"
            disabled={seat === null || evidence.trim() === "" || flip.isPending}
            onClick={() => {
              if (!seat) return;
              // The panel stays open on success: the seats card below it
              // refetches, and the reviewer sees the change they just made
              // rather than the form vanishing under them.
              flip.mutate({
                jurisdiction, section, seat,
                engine_id: engineId,
                evidence_url: evidence.trim(),
              });
            }}
          >
            Record this seat change
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
