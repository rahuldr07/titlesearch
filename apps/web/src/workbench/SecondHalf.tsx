import { useState } from "react";
import { TooltipTrigger } from "react-aria-components";

import { Row } from "./Row";
import { Button } from "../components/ui";
import { Badge, StatusMark } from "../components/ui";
import { Kbd } from "../components/ui";
import { Tooltip } from "../components/ui";
import { Dialog } from "../components/ui";
import { ProgressMeter } from "../components/ui";
import { Skeleton } from "../components/ui";
import { EmptyState } from "../components/ui";
import { Divider } from "../components/ui";
import { Card, InnerPanel } from "../components/ui";

/**
 * The second half of the workbench: marks, progress, surfaces and the overlay.
 * Split from `main.tsx` on the 150-line gate, along the seam between controls
 * a reader OPERATES and surfaces a reader READS.
 */
export function SecondHalf() {
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <>
        <Row title="Marks and status" note="one signal per row — a mark plus weight, never a colour alone">
          <Badge tone="accent">Accent</Badge>
          <Badge tone="settled">Settled</Badge>
          <Badge tone="attend">Attend</Badge>
          <Badge tone="halt">Halt</Badge>
          <StatusMark mark="settled" label="Settled" />
          <StatusMark mark="attend" label="Needs review" />
          <StatusMark mark="halt" label="Halted" />
          <StatusMark mark="tier1" label="T1" />
          <Kbd>C</Kbd>
          <Kbd>?</Kbd>
          <TooltipTrigger>
            <Button variant="secondary">Hover me</Button>
            <Tooltip>A tooltip, 140ms in.</Tooltip>
          </TooltipTrigger>
        </Row>

        <Row title="Progress and absence">
          <div className="w-130"><ProgressMeter label="Decisions" settled={11} total={18} /></div>
          <div className="w-130"><ProgressMeter label="Decisions" settled={18} total={18} /></div>
          <div className="w-100"><Skeleton height="subject" /></div>
          <div className="w-100"><Skeleton height="body" width="half" /></div>
        </Row>

        <Row title="Surfaces">
          <Card className="w-150 p-12">
            <p className="text-meta text-ink-secondary">A 14px surface.</p>
            <InnerPanel className="mt-8 p-8">
              <p className="text-meta text-ink-muted">A 10px panel inside it — inner = outer − gap.</p>
            </InnerPanel>
          </Card>
          <div className="w-150">
            <EmptyState title="No open escalations" reason="Nothing is waiting on a ruling." />
          </div>
        </Row>

        <Row title="Overlay" note="open it — focus must move in, trap, and return on Escape">
          <Button variant="secondary" onPress={() => setDialogOpen(true)}>Open dialog</Button>
          <Dialog
            isOpen={dialogOpen}
            onOpenChange={setDialogOpen}
            title="Keyboard shortcuts"
          >
            <div className="flex flex-col gap-6">
              <p className="text-meta text-ink-secondary">
                Press <Kbd>C</Kbd> now. Nothing behind this dialog may act on it.
              </p>
              <Divider />
              <Button variant="secondary" onPress={() => setDialogOpen(false)}>Close</Button>
            </div>
          </Dialog>
        </Row>
    </>
  );
}
