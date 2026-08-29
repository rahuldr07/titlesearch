import { useState } from "react";
import { TooltipTrigger } from "react-aria-components";

import { Row } from "./Row";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  DialogBody,
  DialogFooter,
  Empty,
  InnerPanel,
  Kbd,
  Popover,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  Progress,
  ProgressIndicator,
  ProgressLabel,
  ProgressMeter,
  ProgressTrack,
  ProgressValue,
  Separator,
  Skeleton,
  StatusMark,
  Tooltip,
} from "../components/ui";

/**
 * The second half of the workbench: marks, progress, surfaces and the overlays.
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
        <StatusMark mark="settled" label="Resting" resting />
        <Kbd>C</Kbd>
        <Kbd>?</Kbd>
        <span className="text-meta text-ink-secondary">
          inline <Kbd muted>⏎</Kbd>
        </span>
        <TooltipTrigger>
          <Button variant="secondary">Hover me</Button>
          <Tooltip>A tooltip, 140ms in.</Tooltip>
        </TooltipTrigger>
      </Row>

      <Row title="Progress and absence" note="the dots are the meter; the bar is for continuous work">
        <div className="w-130"><ProgressMeter label="Decisions" settled={11} total={18} /></div>
        <div className="w-130">
          <ProgressMeter label="Decisions" settled={18} total={18} caption="18 of 18 settled" />
        </div>
        <div className="w-130">
          <Progress value={40} aria-label="Pages read">
            <ProgressLabel>Pages read</ProgressLabel>
            <ProgressValue />
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
        </div>
        <div className="w-100"><Skeleton height="subject" /></div>
        <div className="w-100"><Skeleton height="body" width="half" /></div>
        <div className="w-100"><Skeleton height="label" width="quarter" /></div>
      </Row>

      <Row title="Surfaces" note="inner = outer − gap; a card inside a card throws">
        <Card className="w-150">
          <CardHeader>A 14px surface.</CardHeader>
          <CardBody>
            <InnerPanel>
              <p className="text-meta text-ink-muted">A 10px panel inside it.</p>
            </InnerPanel>
          </CardBody>
        </Card>
        <div className="w-150">
          <Empty
            title="No open escalations"
            reason="Nothing is waiting on a ruling."
            action={<Button variant="secondary" size="sm">Open the queue</Button>}
          />
        </div>
      </Row>

      <Row title="Overlays" note="open them — focus must move in, trap, and return on Escape">
        <Button variant="secondary" onPress={() => setDialogOpen(true)}>Open dialog</Button>
        <PopoverTrigger>
          <Button variant="secondary">Open popover</Button>
          <Popover>
            <PopoverHeader>
              <PopoverTitle>Why this is blocked</PopoverTitle>
              <PopoverDescription>
                A T1 countersign must come from a different examiner.
              </PopoverDescription>
            </PopoverHeader>
          </Popover>
        </PopoverTrigger>
        <Dialog isOpen={dialogOpen} onOpenChange={setDialogOpen} title="Keyboard shortcuts">
          <DialogBody>
            <p className="text-meta text-ink-secondary">
              Press <Kbd>C</Kbd> now. Nothing behind this dialog may act on it.
            </p>
            <Separator className="my-6" />
            <p className="text-meta text-ink-muted">A hairline, not a card edge.</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onPress={() => setDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </Dialog>
      </Row>
    </>
  );
}
