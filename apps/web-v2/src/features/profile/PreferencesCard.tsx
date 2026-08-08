import { useState } from "react";
import { Card, CardBody } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Switch } from "../../shared/ui/Switch";
import { ToggleGroup, Toggle } from "../../shared/ui/ToggleGroup";

/** The zoom steps the design offers for the document pane. Presentation only. */
const ZOOM_CHOICES = ["75%", "100%", "125%"] as const;
const DEFAULT_ZOOM = "100%";

/**
 * Three preferences, and none of them changes what the product decides.
 *
 * That is the filter for this card: a preference may change how something is
 * DRAWN — pane zoom, motion, whether chords are live — and may never change a
 * threshold, a state or what counts as an answer. The moment a preference could
 * alter an outcome it stops being a preference and becomes a client-side rule,
 * which the server owns.
 *
 * NOT A CONTRACT GAP — A WIRING ONE, and the note that said otherwise was
 * wrong. `GET`/`PATCH /api/me/preferences` exists and `Preferences` already
 * carries `default_zoom` and `reduced_motion` (`app/preferences.ts` reads the
 * same endpoint for the fold and the theme). These three controls are local
 * state and hold for the life of the mount; browser storage is forbidden here,
 * so they are left visibly non-persistent rather than faked — a toggle that
 * quietly forgets is worse than one that never claimed to remember. The
 * shortcuts switch is the one with no carrier: nothing on `Preferences` says
 * whether the chord layer is live.
 */
export function PreferencesCard() {
  const [zoom, setZoom] = useState<string>(DEFAULT_ZOOM);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [shortcuts, setShortcuts] = useState(true);

  return (
    <Card>
      <CardBody>
        <Eyebrow variant="section" as="h2">
          Preferences
        </Eyebrow>

        <div className="mt-6 flex flex-wrap items-center gap-6 py-3">
          <span id="pref-zoom" className="min-w-80 flex-1 text-base text-ink-primary">
            Default zoom on the document pane
          </span>
          <ToggleGroup
            aria-labelledby="pref-zoom"
            value={[zoom]}
            onValueChange={(next) => {
              const picked = next.at(0);
              if (picked !== undefined) setZoom(picked);
            }}
            className="gap-2"
          >
            {ZOOM_CHOICES.map((choice) => (
              <Toggle
                key={choice}
                value={choice}
                className="rounded-5 px-6 py-3 font-mono text-sm"
              >
                {choice}
              </Toggle>
            ))}
          </ToggleGroup>
        </div>

        <PreferenceRow label="Reduced motion" id="pref-motion">
          <Switch
            aria-labelledby="pref-motion"
            checked={reducedMotion}
            onCheckedChange={setReducedMotion}
          />
        </PreferenceRow>

        <PreferenceRow label="Keyboard shortcuts" id="pref-keys">
          <Switch
            aria-labelledby="pref-keys"
            checked={shortcuts}
            onCheckedChange={setShortcuts}
          />
        </PreferenceRow>
      </CardBody>
    </Card>
  );
}

/**
 * The switch rows are identical but for their label, and the label is what
 * names the control for a screen reader — so the id pairing lives in one place
 * rather than being retyped per row, where one typo silently unnames a switch.
 */
function PreferenceRow({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-6 border-t border-line-subtle py-5">
      <span id={id} className="flex-1 text-base text-ink-primary">
        {label}
      </span>
      {children}
    </div>
  );
}
