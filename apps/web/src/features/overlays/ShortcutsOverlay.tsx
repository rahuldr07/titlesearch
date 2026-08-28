import { Button, Dialog, DialogBody, DialogFooter, Kbd } from "../../components/ui";
import { overlayCap } from "../../components/ui/overlaySurface";
import { CHORD_SECTIONS, chordsIn, type ChordSection } from "../../app/keyboard/keymap";
import { useOverlayOpen, useOverlays } from "../../app/keyboard/overlays";

/**
 * THE `?` SHORTCUT LIST — rendered FROM `keymap.ts`, never transcribed.
 *
 * The design titles this "Keyboard Shortcuts & Examination HUD" under the
 * eyebrow "Examiner Velocity Guide". "Velocity" is dropped: INVARIANT 23 bans
 * pace framing, and a cheat sheet that sells speed to a reader whose job is
 * accuracy is the framing the invariant exists to stop. The design's footer —
 * "SOC 2 Compliance: All keyboard actions logged with actor identity" — is also
 * dropped: nothing in the contract backs a SOC 2 claim, and a compliance claim
 * printed under a keyboard list is one nobody can cite.
 *
 * What replaces it is the fact that IS true: every row here is a row
 * `GlobalKeys` installs. The previous version of this overlay listed seven
 * review keys (C/E/Q/J/K/Z and double-click) that no screen binds.
 *
 * `data-testid="key-map"` is kept — `key-map-modal.spec` owns that handle, and
 * renaming a test's grip on a component is not a rename, it is a deletion.
 */
export function ShortcutsOverlay() {
  const open = useOverlayOpen("key-map");
  const close = useOverlays((s) => s.close);

  return (
    <Dialog
      title="Keyboard as navigation"
      testId="key-map"
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) close("key-map");
      }}
    >
      <DialogBody>
        <div className={overlayCap}>
          <div className="flex flex-col gap-10">
            {CHORD_SECTIONS.map((section) => (
              <Section key={section} title={section} />
            ))}
          </div>
        </div>
        <p className="text-meta leading-body text-ink-muted">
          Every row is a key this app installs. A shortcut the screens do not
          bind cannot be listed here.
        </p>
      </DialogBody>
      <DialogFooter>
        <Button onPress={() => close("key-map")}>Close</Button>
      </DialogFooter>
    </Dialog>
  );
}

function Section({ title }: { readonly title: ChordSection }) {
  const rows = chordsIn(title);
  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-label font-bold leading-flat text-ink-muted">{title}</h3>
      <dl className="rounded-sm border border-line-subtle bg-control-fill">
        {rows.map((row) => (
          <div
            key={row.id}
            data-chord={row.chord}
            className="flex items-center justify-between gap-6 border-b border-line-subtle px-6 py-4 last:border-b-0"
          >
            <dt className="text-meta leading-close text-ink-secondary">{row.desc}</dt>
            <dd className="shrink-0">
              <Kbd>{row.cap}</Kbd>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
