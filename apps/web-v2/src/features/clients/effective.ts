import { BASELINE_LINES } from "./baseline";

/**
 * The resolved checklist — baseline behind, client deltas on top.
 *
 * CONTRACT GAP: RESOLUTION IS SERVER WORK AND THIS FILE DOES NOT DO IT. At
 * intake the server resolves a client against a product baseline and freezes
 * the result onto the order with a config version. Re-implementing that here
 * would give one question two answers free to drift, which is the exact defect
 * the design's own footnote warns about ("resolved through the same function
 * intake uses, so this matrix cannot disagree with what an order actually
 * gets"). So the treatments below are TRANSCRIBED server output, not derived
 * from the override list — the composition step only pairs them with labels.
 *
 * Fixtures exist for the YEAR baseline only. Every other product chip resolves
 * to a named "no fixture" state rather than a plausible-looking guess.
 */
export type Treatment = "baseline" | "narrowed" | "replaced" | "waived" | "added";

export interface EffectiveLine {
  key: string;
  /** The line number, or "＋" for a line this client added. */
  n: string;
  label: string;
  treatment: Treatment;
  /** The narrowing, the replacement, or the reason for a waive. */
  detail: string | null;
  /** Only on client-added lines — where the added line applies. */
  addedScope: string | null;
}

export interface Conflict {
  key: string;
  n: number;
  label: string;
  /** The client's stated reason, quoted back verbatim. */
  override: string;
}

/** The product key the fixtures below were resolved against. */
export const RESOLVED_KEY = "y";

export const TREATMENT_LABEL: Readonly<Record<Treatment, string>> = {
  baseline: "from baseline",
  narrowed: "narrowed",
  replaced: "replaces standard",
  waived: "waived",
  added: "client-added",
};

interface Delta {
  treatment: Treatment;
  detail: string;
  /** A replacement carries its own wording; the baseline label is not it. */
  label?: string;
}

/** Sparse: a line absent from a client's map is one the server resolved as baseline. */
const DELTAS: Readonly<Record<string, Readonly<Record<number, Delta>>>> = {
  svb: {
    9: {
      treatment: "narrowed",
      detail: "against the current owner only · recorded in the last 24 months",
    },
    11: {
      treatment: "waived",
      detail: "Summit supplies its own GIS parcel map; plat not required.",
    },
    12: {
      treatment: "replaced",
      label: "Merging sequence — Summit custom order",
      detail: "Client-specified merge order (rev 3), replaces the standard sequence.",
    },
  },
  cactus: {
    6: {
      treatment: "waived",
      detail: "Cactus waives deed-chain completeness — accepts current vesting only.",
    },
  },
};

const ADDED: Readonly<Record<string, readonly EffectiveLine[]>> = {
  cactus: [
    {
      key: "ctp-add",
      n: "＋",
      label: "HOA estoppel / CC&R reference attached",
      treatment: "added",
      detail: "Cactus onboarding requirement",
      addedScope: "all products · Cactus-specific, not in standard catalogue",
    },
  ],
};

/**
 * A waive on a load-bearing line. Not derived — the server decides what is
 * load-bearing for a product, and this transcribes which pairings it flagged.
 */
export function conflictsFor(clientId: string): readonly Conflict[] {
  const deltas = DELTAS[clientId] ?? {};
  return BASELINE_LINES.filter(
    (l) => l.loadBearing && deltas[l.n]?.treatment === "waived",
  ).map((l) => ({
    key: `${clientId}-${l.n}`,
    n: l.n,
    label: l.label,
    override: deltas[l.n]?.detail ?? "",
  }));
}

export function effectiveLines(clientId: string): readonly EffectiveLine[] {
  const deltas = DELTAS[clientId] ?? {};
  const resolved = BASELINE_LINES.map((l): EffectiveLine => {
    const delta = deltas[l.n];
    return {
      key: `${clientId}-${l.n}`,
      n: String(l.n),
      label: delta?.label ?? l.label,
      treatment: delta?.treatment ?? "baseline",
      detail: delta?.detail ?? null,
      addedScope: null,
    };
  });
  return [...resolved, ...(ADDED[clientId] ?? [])];
}
