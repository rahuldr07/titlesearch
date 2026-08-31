import { cx } from "./cx";

/**
 * Initials-only avatar. Deliberately no image: the contract has no avatar
 * endpoint, and an avatar URL is a network request per row on proxied and
 * airgapped deployments.
 *
 * `initials` is required, never derived from `name` — "R. Menon", "Ana R.
 * Delgado" and a surname-first record share no rule, and a silently wrong
 * derivation puts a wrong identity on a countersign row. The caller, who
 * knows the record, supplies both.
 */
export type AvatarProps = {
  /** The full name. What assistive technology announces. */
  readonly name: string;
  /** One or two characters. Supplied, never derived — see above. */
  readonly initials: string;
  /** `md` is a row; `sm` fits an inline byline. */
  readonly size?: "sm" | "md" | undefined;
  /**
   * The dark chrome register (rail, auth screen, code panel). The app palette
   * on the rail surface measures 1.03:1 — invisible, not merely faint.
   */
  readonly onRail?: boolean | undefined;
  readonly className?: string | undefined;
};

export function Avatar({ name, initials, size = "md", onRail, className }: AvatarProps) {
  return (
    <span
      data-slot="avatar"
      data-size={size}
      // role="img" makes the name and glyphs one object; the initials inside
      // are decoration for the accessible name.
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

/** A person, named — avatar plus name and optional role detail. */
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
