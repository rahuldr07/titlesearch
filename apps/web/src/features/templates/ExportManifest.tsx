import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogTrigger,
  InnerPanel,
} from "../../components/ui";
import { SpecAbsent, SpecValue } from "./SpecDetail";

/**
 * TEMPLATE EXPORT & CRYPTOGRAPHIC MANIFEST.
 *
 * `TemplateResponse` carries `version`, `blocks`, `samples` and `export_spec`.
 * The version is the server's and is printed. The design's other two rows are
 * not on it:
 *
 *   - MAPPED FIELDS is a server figure about the mapping. `blocks.length` is a
 *     count the browser took of a different list, and passing it off as the
 *     mapped-field count is how a shape with unmapped fields reads as complete.
 *   - THE SHA-256 SEAL is computed over the bytes the server emits. Hashing
 *     what this screen happens to hold would seal the browser's copy and print
 *     a digest that means nothing to whoever verifies it.
 */
export function ExportManifest({ version }: { readonly version: string }) {
  return (
    <DialogTrigger>
      <Button variant="ghost" size="sm" data-testid="open-export-manifest">
        Export &amp; manifest
      </Button>
      <Dialog title="Template export & cryptographic manifest">
        <DialogBody>
          <p data-testid="export-manifest" className="font-sans text-meta leading-body text-ink-secondary">
            The template spec the composer consumes, at version{" "}
            <span className="font-mono text-ink-primary">{version}</span>. The spec itself is
            printed on the screen behind this, verbatim, as the server composed it. The
            design&rsquo;s &ldquo;zero cross-client contamination&rdquo; stamp is not here:
            nothing in the contract asserts isolation, and a compliance claim this screen
            wrote itself would be worth nothing to the auditor reading it.
          </p>

          <InnerPanel padding="tight">
            <div className="flex flex-col gap-6">
              <SpecValue label="Template version">
                {/* Rule 3: a version is an identifier. */}
                <span className="font-mono font-semibold">{version}</span>
              </SpecValue>
              <SpecAbsent
                testId="export-mapped-absent"
                label="Mapped fields"
                shape="TemplateResponse.mapped_fields / total_fields: number"
                why="The server knows how many of the shape's fields are mapped. This screen only has a block list, and its length is a different number."
              />
              <SpecAbsent
                testId="export-source-absent"
                label="Reference source and citation"
                shape="TemplateResponse.source: { ref: string; citation: string }"
                why="The design's audit tab names the client document this shape was derived from. Nothing on the wire records it, and a provenance line nobody can follow back is worse than none."
              />
              <SpecAbsent
                testId="export-digest-absent"
                label="SHA-256 seal digest"
                shape="TemplateResponse.export_sha256: string"
                why="A seal fixes the bytes the server emitted. One computed here would fix this browser's copy instead, and verify against nothing."
              />
            </div>
          </InnerPanel>
        </DialogBody>
        <DialogFooter>
          <Button slot="close">Close</Button>
        </DialogFooter>
      </Dialog>
    </DialogTrigger>
  );
}
