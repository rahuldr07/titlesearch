import type { ReactNode } from "react";

/**
 * A mono cell, for data: order refs, money, citations, hashes, timestamps.
 * A column opts in by wrapping rather than by a `mono: true` flag — a flag
 * would be the table knowing what its data means.
 */
export function DataCell({ children }: { readonly children: ReactNode }) {
  return <span className="font-mono text-meta leading-close text-ink-secondary">{children}</span>;
}
