import { cx } from "./cx";

/**
 * ADAPTED FROM THE REGISTRY `avatar`, AND THE IMAGE IS DELETED.
 *
 * The registry ships six components — `Avatar`, `AvatarImage`, `AvatarFallback`,
 * `AvatarBadge`, `AvatarGroup`, `AvatarGroupCount` — built around an `<img>`
 * with a three-state load machine behind it. This kit ships ONE, and it takes a
 * name.
 *
 * ══ WHY THERE IS NO IMAGE ═══════════════════════════════════════════════════
 *
 *   - THE DESIGN SHIPS NO BINARY ASSETS. There is no avatar endpoint, no upload
 *     path and no stored image anywhere in the contract. `AvatarImage` would be
 *     a component whose only possible `src` is one a screen invented.
 *   - AN AVATAR URL IS A NETWORK REQUEST PER ROW. This is an internal tool for
 *     examiners on proxied and airgapped deployments — the same argument the
 *     token file makes for self-hosting the three faces. A gravatar hash is
 *     also an email address handed to a third party, which for a QC reviewer's
 *     identity is not a decision a UI kit gets to make.
 *   - `AvatarFallback` ONLY EXISTS BECAUSE THE IMAGE CAN FAIL. With no image
 *     there is no fallback: there is just the thing that renders, and it is
 *     initials. Two components collapse into none.
 *
 * `AvatarBadge` goes with them — it drew a filled `bg-primary` dot, and rule 1
 * spends the accent ONCE per screen, which a per-row presence dot is the
 * opposite of. `AvatarGroup`'s `-space-x-2` overlap goes too: overlapping
 * circles are decoration, and the count that follows them ("+3") is a number
 * the browser derived, which rule 11 forbids. A list of examiners is a list.
 *
 * ══ WHAT THE INITIALS ARE, AND WHAT THEY ARE NOT ════════════════════════════
 *
 * `initials` is a REQUIRED PROP, not derived from `name` inside here. Deriving
 * them looks obviously right and is not: "R. Menon" and "Ana R. Delgado" and a
 * Hungarian surname-first record do not share a rule, and a component silently
 * getting it wrong produces a wrong identity on a countersign row — the exact
 * screen where identity is load-bearing (rule 13: a T1 countersign must come
 * from a DIFFERENT user). So the caller, who knows the record, supplies both,
 * and `name` is what a screen reader hears.
 */
export type AvatarProps = {
  /** The full name. What assistive technology announces. */
  readonly name: string;
  /** One or two characters. Supplied, never derived — see above. */
  readonly initials: string;
  /**
   * `md` is a row; `sm` fits an inline byline. Both from the token file's
   * square-control sizes; there is no `lg`, because nothing in the design
   * displays a person larger than a row.
   */
  readonly size?: "sm" | "md" | undefined;
  /**
   * The DARK CHROME register — the rail, the auth screen, a code panel. Not a
   * theme: `tokens.css` is explicit that `--color-rail-*` is a surface
   * vocabulary, and a component reaching into the app palette while standing on
   * that column renders at 1.03:1, which is invisible rather than merely faint.
   */
  readonly onRail?: boolean | undefined;
  readonly className?: string | undefined;
};

export function Avatar({ name, initials, size = "md", onRail, className }: AvatarProps) {
  return (
    <span
      data-slot="avatar"
      data-size={size}
      // The name is the accessible name; the glyphs inside are decoration for
      // it. `role="img"` is what makes the two one object rather than a label
      // floating beside two stray letters.
      role="img"
      aria-label={name}
      title={name}
      className={cx(
        "inline-flex shrink-0 select-none items-center justify-center rounded-pill border",
        "font-sans leading-flat font-semibold",
        size === "sm" ? "size-11 text-label" : "size-13 text-label",
        onRail === true
          ? "border-rail-line bg-rail-deep text-rail-ink"
          : "border-line-strong bg-surface-sunken text-ink-secondary",
        className,
      )}
    >
      <span aria-hidden>{initials}</span>
    </span>
  );
}

/**
 * A person, named. The shape every screen actually wants — the avatar alone is
 * a puzzle, and "R. Menon (QC)" is the sentence the design's countersign panel
 * writes out in full.
 */
export function AvatarLabel({
  name,
  initials,
  detail,
  onRail,
  className,
}: Omit<AvatarProps, "size"> & {
  /** The role or qualifier, e.g. "QC". Optional: not everyone has one. */
  readonly detail?: string | undefined;
}) {
  return (
    <span
      data-slot="avatar-label"
      className={cx("inline-flex items-center gap-5", className)}
    >
      <Avatar name={name} initials={initials} size="sm" {...(onRail === true ? { onRail } : {})} />
      <span
        className={cx(
          "font-sans text-meta leading-close",
          onRail === true ? "text-rail-ink" : "text-ink-primary",
        )}
      >
        {name}
        {detail !== undefined && (
          <span
            className={cx(
              "ml-3 font-sans text-label leading-flat",
              onRail === true ? "text-rail-ink-muted" : "text-ink-muted",
            )}
          >
            {detail}
          </span>
        )}
      </span>
    </span>
  );
}
