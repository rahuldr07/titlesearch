/**
 * THE SEAL AT THE FOOT OF THE SHEET.
 *
 * ══ THE DESIGN'S SOC 2 LINE IS NOT TRANSCRIBED ═════════════════════════════
 *
 * The prototype prints "SOC 2 Type II Certified" beside the digest, with a
 * barcode and a timestamp. That is a COMPLIANCE ATTESTATION about the
 * organisation, and nothing on the wire backs it: `CompositionResponse` carries
 * a `seal_sha256` and nothing else — no auditor, no report period, no opinion.
 * A certification claim drawn from a hash field is an emitted value with no
 * citation, which is the one thing this product may never do.
 *
 * So the digest says what it is instead, and stops there.
 */
export function IntegritySeal(props: { readonly seal: string | null }) {
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
    <div data-testid="integrity-seal" className="flex flex-col gap-3">
      <span className="font-serif text-label leading-flat tracking-caps uppercase text-page-ink">
        Cryptographic integrity seal
      </span>
      {/* Rule 3: a digest is data. */}
      <code className="rounded-paper border border-page-line bg-surface-paper p-4 font-mono text-label leading-body break-all text-scan-ink">
        {props.seal}
      </code>
      <p className="max-w-260 font-sans text-label leading-body text-scan-ink">
        SHA-256 over the manifest the server composed, stamped when the release
        was filed. It fixes which bytes were released. It is not an audit
        opinion and asserts nothing about how this office is assessed.
      </p>
    </div>
  );
}
