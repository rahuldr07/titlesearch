import { Eyebrow } from "../../shared/ui/Eyebrow";
import { ToggleGroup, Toggle } from "../../shared/ui/ToggleGroup";

/**
 * `RuleProvenance` has four values. Only two of them can be authored.
 */
export type AuthorableTag = "RULED" | "DERIVED";

const AUTHORABLE: readonly AuthorableTag[] = ["RULED", "DERIVED"];

/**
 * ONLY TWO OF THE FOUR PROVENANCE TAGS ARE OFFERED, and the sentence above the
 * chips explains why rather than leaving the absence to be noticed.
 *
 * OPEN and CONFLICT are assigned by the machine: OPEN when no authority
 * resolves the question, CONFLICT when two rules collide. Both are states a
 * rule is PUT INTO by the world, and neither can be confirmed. Letting an
 * author stamp one by hand manufactures a rule that can never go live and has
 * no counterpart to resolve against — a dead entry in a book where nothing is
 * ever deleted.
 *
 * The two offered are radio semantics, not checkboxes: a rule has one
 * provenance, and a draft carrying two would be unresolvable at save time.
 */
export function TagChoice({
  value,
  onChange,
}: {
  value: AuthorableTag;
  onChange: (tag: AuthorableTag) => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      <Eyebrow variant="field" as="h3">
        Provenance tag
      </Eyebrow>
      <p className="text-tiny leading-body text-ink-muted">
        OPEN and CONFLICT are assigned by the machine, not chosen here — a rule
        can&rsquo;t be authored into a state it can never leave.
      </p>
      <ToggleGroup
        aria-label="Provenance tag"
        value={[value]}
        onValueChange={(next) => {
          const [tag] = next;
          // Base UI clears on re-press; a rule always has a provenance, so the
          // current choice stands rather than becoming undefined.
          if (tag === "RULED" || tag === "DERIVED") onChange(tag);
        }}
      >
        {AUTHORABLE.map((tag) => (
          <Toggle key={tag} value={tag}>
            {tag}
          </Toggle>
        ))}
      </ToggleGroup>
    </div>
  );
}
