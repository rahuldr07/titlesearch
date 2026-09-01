/**
 * The seal at the foot of the sheet. The timestamp is the server's
 * `released_at`, printed untouched, and absent until a release filed one.
 */
export function IntegritySeal(props: {
  readonly seal: string | null;
  readonly releasedAt: string | null;
}) {
  if (props.seal === null) {
    return (
      <div data-testid="integrity-seal-absent" className="flex flex-col gap-3">
        <span className="font-serif text-label leading-flat tracking-caps uppercase text-page-ink">
          No integrity seal
        </span>
        <p className="font-sans text-label leading-body text-scan-ink">
          The digest exists only once a release is filed. The server computes it
          over the composed manifest and returns it; until then this sheet is a
          proof, not a deliverable.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="integrity-seal"
      className="flex flex-wrap items-start justify-between gap-8"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <span className="font-serif text-label leading-flat tracking-caps uppercase text-page-ink">
          Cryptographic integrity seal
        </span>
        <code className="max-w-260 rounded-paper border border-page-line bg-surface-paper p-4 font-mono text-label leading-body break-all text-scan-ink">
          {props.seal}
        </code>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        {props.releasedAt !== null && (
          <>
            <span className="font-serif text-label leading-flat tracking-caps uppercase text-page-ink">
              Released
            </span>
            <span className="font-mono text-label leading-flat text-scan-ink">
              {props.releasedAt}
            </span>
          </>
        )}
        {/* A quiet ornament on the stock, aria-hidden. */}
        <div aria-hidden className="flex items-start gap-1 pt-3 opacity-40">
          {BARS.map((tall, index) => (
            <span
              // rules-allow: a static ornament's bars have no identity beyond position (RULING-2026-08-29 draws the barcode)
              key={index}
              className={`w-1 bg-page-ink ${tall ? "h-10" : "h-7"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Twelve bars, every third one tall. */
const BARS = Array.from({ length: 12 }, (_, i) => i % 3 === 0);
