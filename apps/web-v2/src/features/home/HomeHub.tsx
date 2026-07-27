import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useHotkeys } from "react-hotkeys-hook";
import { doorsFor } from "../../entities/nav/doors";
import { useSession } from "../../shared/session";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Card, CardBody } from "../../shared/ui/Card";

/**
 * The hub — the map, live.
 *
 * DOORS ARE ABSENT, NEVER DIMMED (`home.spec` #2). A reviewer does not see a
 * greyed-out readout; the readout is not part of their job and does not appear.
 *
 * NOTHING FORBIDDEN LEAKS HERE (`home.spec` #5, constraint 7): no throughput,
 * no pace, no accuracy figure, and no backlog COUNT. "3 orders waiting" is a
 * queue depth, and a queue depth is a pace signal wearing a neutral face — the
 * queue serves one order and this page says so without a number.
 *
 * ⏎ opens the role's first door, so the keyboard default is whatever the
 * server ranked first rather than whatever happens to be leftmost.
 */
export function HomeHub() {
  const role = useSession((s) => s.role);
  const doors = doorsFor(role).filter((door) => door.path !== "/");
  const firstRef = useRef<HTMLAnchorElement>(null);

  // Focus the first door so Enter has an obvious target and a keyboard user
  // lands somewhere rather than on the document body.
  useEffect(() => firstRef.current?.focus(), []);

  useHotkeys(
    "enter",
    () => firstRef.current?.click(),
    { preventDefault: true },
    [],
  );

  return (
    <div data-testid="home-hub" className="flex flex-col gap-8">
      <Eyebrow variant="screen">TitlePipe</Eyebrow>
      <p className="text-base text-ink-secondary">
        Work comes to you — the system decides what is next. Press{" "}
        <span className="font-mono">?</span> for the map.
      </p>

      <ul className="flex flex-col gap-4">
        {doors.map((door, i) => (
          <li key={door.path}>
            <Link
              to={door.path}
              data-testid={`door-${door.path}`}
              ref={i === 0 ? firstRef : undefined}
              className="block"
            >
              <Card>
                <CardBody className="flex items-baseline gap-5">
                  <span className="w-12 font-mono text-md font-semibold text-action">
                    g {door.key}
                  </span>
                  <span className="text-md font-semibold text-ink-primary">
                    {door.label}
                  </span>
                </CardBody>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
