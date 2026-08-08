import { Card } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { ScreenHeading } from "../../shared/ui/ScreenHeading";

/**
 * The header states the ONE thing that stops this screen being dangerous: what
 * an edit here does, and when.
 *
 * Two different kinds of write live behind the same tabs. A record (a product,
 * a client) is created directly and nothing downstream moves. Behaviour config
 * — line wording, baseline cells, client overrides — publishes a NEW CONFIG
 * VERSION, and an order already in flight keeps the version it was stamped
 * with. Without that sentence in front of the tabs, "save" reads as "change
 * every open order", which is the one thing it must never mean.
 *
 * The version chip is therefore not decoration: it is the identifier the order
 * carries. It comes from the server and the screen never increments it — only a
 * publish the server accepted may move it.
 *
 * THE CHIP RIDES ON THE HEADING ROW, not under the lede. Bottom-aligned against
 * the whole block it drifted further from the title the longer that sentence
 * ran, until the identifier an order is stamped with read as a footnote to a
 * paragraph about saving. `ScreenHeading`'s `actions` pairs it with the h1,
 * where it belongs whatever the copy does.
 */
export function ConfigHeader({
  canAuthor,
  configVersion,
  frozen,
}: {
  canAuthor: boolean;
  configVersion: string;
  frozen: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ScreenHeading
        eyebrow="Admin · Products & sign-off"
        /*
          NO `<em>` HERE, DELIBERATELY. RULE: the design's signature italic
          takes the CLOSING PHRASE of a heading; a one-word heading has none.
          FAILURE PREVENTED: the only way to reach the italic from "Configuration"
          is to set the entire h1 in it, which stops being an emphasis and
          becomes a second typeface for one screen — the mockup's own finding is
          that the display face earns its place by being spent rarely.
        */
        title="Configuration"
        lede={
          <p>
            Editable without a release. Records (products, clients) create directly;
            behaviour config (line wording, baseline cells, overrides) publishes a new
            config version on save. Nothing is deleted — things retire. Never reaches an
            order already in flight.
          </p>
        }
        actions={<VersionStamp configVersion={configVersion} frozen={frozen} />}
      />

      {/*
        The banner is a COURTESY, never the control. The server refuses an
        unauthorised write on its own; this only explains why the authoring
        controls are absent, so a reviewer does not read a missing button as a
        broken screen. `tone="attend"` binds its ground to its hairline — the
        same pair the line-editor's version warning wears, because both say
        "this is a caution, not a failure" and a reader should not have to
        decide whether two amber tints mean two different things.
      */}
      {canAuthor ? null : (
        <Card
          size="nested"
          tone="attend"
          data-testid="config-read-only"
          className="px-7 py-5 text-xs leading-body text-state-attend-ink"
        >
          Viewing only. Authoring is limited to admin and engineer — the server enforces
          this independently. Switch role via the account menu to preview editing.
        </Card>
      )}
    </div>
  );
}

/**
 * The version an order gets stamped with, plus what the server says about it.
 *
 * FROZEN IS THE SERVER'S WORD, not a UI mode. It says this version is closed to
 * further change, so the next accepted edit mints a new one — which is exactly
 * what makes the number above it safe to stamp on an order.
 */
function VersionStamp({
  configVersion,
  frozen,
}: {
  configVersion: string;
  frozen: boolean;
}) {
  return (
    <div className="text-right">
      {/*
        THE LABEL IS OURS; THE IDENTIFIER IS THE SERVER'S. The export puts the
        word inside the chip ("config v4"), which it can afford because its one
        demo version is a string it also minted. This screen must never mint or
        decorate a version — an order is stamped with exactly what the server
        sent — so the chip prints `cfg-2026.07-3` verbatim and the eyebrow says
        what kind of string it is. Without the label the header's only opaque
        token sat between "frozen…" and "applies to new orders only" with
        nothing naming it, and an unlabelled identifier is read as a build tag.
      */}
      <span className="flex items-center justify-end gap-4">
        <Eyebrow variant="field">Config</Eyebrow>
        <Chip
          tone="action"
          size="md"
          shape="mono"
          bordered
          className="normal-case"
          data-testid="config-version"
        >
          {configVersion}
        </Chip>
      </span>
      {frozen ? (
        <p
          className="mt-2 text-tiny font-semibold text-ink-secondary"
          data-testid="config-frozen"
        >
          frozen — the next accepted edit mints a new version
        </p>
      ) : null}
      <p className="mt-2 text-tiny text-ink-muted">
        current · applies to new orders only
      </p>
    </div>
  );
}
