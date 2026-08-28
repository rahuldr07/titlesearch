import { useOverlays } from "../keyboard/overlays";
import { Kbd } from "../../components/ui";

/**
 * THE BRAND BLOCK and THE SEARCH BOX — the top of the design's rail.
 *
 * ══ THE MARK ═══════════════════════════════════════════════════════════════
 *
 * Rule 7: a FLAT brand mark, no gradient, and the design's own note says it is
 * "typed 'TF' in a flat square" — never an asset. 24px, radius 14 per the
 * reference. The design draws it in `--ink-primary` on the rail, which is the
 * one place that near-black reads as a deliberate cut-out rather than as the
 * invisible 1.03:1 it measures as text.
 *
 * THE WORDMARK IS "TitlePipe", NOT THE DESIGN'S "TitleFlow". The bundle
 * disagrees with itself — `README.md` §Overview opens "TitlePipe turns a
 * scanned county title package into…" and names the product TitlePipe
 * throughout, while the prototype's rail prints "TitleFlow". The package name,
 * the contract package (`@titlepipe/contract`) and every document in this repo
 * say TitlePipe, so the prototype string is the outlier and is treated as one.
 *
 * ══ THE SUBTITLE IS THE DESIGN'S, AND IT IS A CLAIM ════════════════════════
 *
 * The reference prints "SOC 2 Abstract Engine". "SOC 2" is a COMPLIANCE
 * ATTESTATION — either an auditor has issued a report or they have not, and a
 * rail that asserts one is making a legal claim on behalf of the company from a
 * hard-coded string in a nav component. There is nothing in the contract that
 * reports attestation status, so this cannot be bound to a fact.
 *
 * "Title abstract engine" is printed instead: the same descriptive line with
 * the unverifiable claim removed, taken from README §Overview's own sentence.
 * FLAGGED, not silently dropped — if the attestation is real it belongs to a
 * settings screen that can name the report and its date, not to the chrome.
 *
 * ══ THE STATUS DOT ═════════════════════════════════════════════════════════
 *
 * The design's dot is a bare green circle with no tooltip and nothing behind
 * it. A permanently-green health indicator that is never anything else is worse
 * than no indicator: it trains the reader that green means nothing.
 *
 * It is drawn, because it is in the design, but it says what it means. It is
 * bound to the ONE fact this client genuinely holds without inventing a health
 * endpoint: whether the door payload arrived. `connected=false` is the state
 * the design has no drawing for, and it is the state a status dot exists for.
 */
export function RailBrand(props: { readonly connected: boolean }) {
  return (
    <>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-ink-primary text-meta font-bold leading-flat text-surface-panel">
            TF
          </span>
          <span className="truncate text-subject font-bold leading-flat tracking-tight text-surface-panel">
            TitlePipe
          </span>
        </div>
        <span className="truncate text-label leading-flat text-rail-ink-muted">
          Title abstract engine
        </span>
      </div>
      <span
        data-testid="rail-status"
        role="img"
        title={
          props.connected
            ? "Connected — your permissions loaded"
            : "Not connected — permissions have not loaded, so no door is drawn"
        }
        aria-label={props.connected ? "Connected" : "Not connected"}
        className={
          props.connected
            ? "size-4 shrink-0 rounded-pill bg-state-settled"
            : "size-4 shrink-0 rounded-pill bg-state-halt"
        }
      />
    </>
  );
}

/**
 * THE SEARCH BOX — a BUTTON, not an input, and the design agrees: the reference
 * markup is `<button on-click="openPalette">` with placeholder text and a ⌘K
 * cap. It looks like a field because what it opens IS a search surface.
 *
 * Built as a button rather than a real field for the reason `GlobalKeys.tsx`
 * already records: THERE IS NO SEARCH TO FOCUS. The design's search belongs to
 * screen 3 (All Orders), which `CONFLICT-all-orders.md` records as a hard
 * conflict — `INVARIANTS:82-83` forbids a browsable order list. A text input
 * here would accept typing and then have nowhere to send it.
 *
 * `Kbd` is the kit's, mono per rule 3 (a chord is one of the five things mono
 * is for). The chord is printed as ⌘K exactly as the design does; `GlobalKeys`
 * binds `$mod+k`, which is Ctrl on the machines this ships to.
 */
export function RailSearch() {
  const toggle = useOverlays((s) => s.toggle);
  return (
    <div className="px-6 pt-6">
      <button
        type="button"
        data-testid="rail-search"
        onClick={() => toggle("palette")}
        className="tp-state tp-press flex h-19 w-full items-center gap-4 rounded-lg border border-rail-line bg-rail-line px-6 text-meta leading-flat text-rail-ink-muted hover:text-rail-ink"
      >
        <SearchGlyph />
        <span className="min-w-0 flex-1 truncate text-left">Quick jump…</span>
        {/* `rounded-lg` overrides `Kbd`'s own `--radius-xs`: a key cap is normally
            the innermost object in rule 5's ladder, but this one sits INSIDE a
            14px field and the design draws it at the field's radius, not a
            step below it. Still a token, still on the six-radius scale. */}
        <Kbd className="shrink-0 rounded-lg border-transparent bg-rail-line text-rail-ink">
          ⌘K
        </Kbd>
      </button>
    </div>
  );
}

/**
 * The one glyph in the rail. Rule 7 bans "icon soup", and the design's rail
 * draws per-door icons that are deleted with the door rows — a word plus a
 * picture of the same word is the soup. This magnifier survives because the
 * search box has no label of its own: without it the row is placeholder text.
 */
function SearchGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
