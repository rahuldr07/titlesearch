import type { Door } from "../entities/nav/doors";
import { Card, CardBody } from "../shared/ui/Card";
import { Eyebrow } from "../shared/ui/Eyebrow";

/**
 * The `?` overlay — the whole keyboard layer, written down.
 *
 * It lists only the doors the acting role holds, from the same table the
 * navigator and the server read. A map naming a screen you cannot open is a map
 * that teaches a shortcut that will refuse you.
 *
 * It is MODAL: while it is up the screen underneath stands its own keys down,
 * so `c` does not open an editor behind it. A cheat sheet that fires the
 * commands it is describing is a trap.
 */
export function KeyMap({ doors }: { doors: readonly Door[] }) {
  return (
    <div className="fixed inset-0 z-(--z-overlay) flex items-center justify-center bg-scrim p-9">
      <div data-testid="key-map" className="w-full max-w-160">
        <Card size="emphasis">
          <CardBody>
            {/*
              Upper-case in the MARKUP, not via `text-transform`:
              `navigation.spec` #1 matches this case-sensitively, and a CSS
              transform does not change what the text actually says.
            */}
            <Eyebrow variant="screen">KEYBOARD AS NAVIGATION</Eyebrow>
            <p className="mt-3 text-base text-ink-secondary">
              Press <span className="font-mono">g</span> then a key.{" "}
              <span className="font-mono">[</span> folds the navigator. Escape
              closes this.
            </p>
            <ul className="mt-8 flex flex-col gap-3">
              {doors.map((door) => (
                <li key={door.path} className="flex items-baseline gap-5">
                  <span className="w-12 font-mono text-md font-semibold text-action">
                    g {door.key}
                  </span>
                  <span className="text-base text-ink-primary">{door.label}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
