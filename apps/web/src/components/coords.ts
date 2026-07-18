import { z } from "zod";

/**
 * Coordinate types + the single opaque-coords mapping, split from PdfPane so
 * screens can import them WITHOUT pulling react-pdf/pdfjs into their chunk —
 * the pane itself is lazy-loaded (bundle: pdfjs is ~400 kB and only Review-
 * family screens need it, and only when a real file URL exists).
 *
 * `line_coords` is contractually opaque (final shape lands with the
 * LLMWhisperer adapter, P2). Everything codes against the minimal normalized
 * rect below, and the mapping lives in exactly ONE function
 * (`parseLineCoords`). Engines without coordinates declare none — no overlay,
 * snippet callout only. Never a faked box.
 */

export interface NormRect {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const NormRectSchema = z.object({
  page: z.number().int(),
  x0: z.number(),
  y0: z.number(),
  x1: z.number(),
  y1: z.number(),
});

/** THE single opaque-coords → normalized-rects mapping. */
export function parseLineCoords(value: unknown): NormRect[] {
  const parsed = z.array(NormRectSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export type HighlightTone = "ok" | "attend" | "act" | "pin";

export interface PdfHighlight {
  id: string;
  /** Normalized rects on the current page; empty → snippet callout at fallback position. */
  rects: NormRect[];
  tone: HighlightTone;
  chip: string;
  snippet?: string | undefined;
  onClick?: (() => void) | undefined;
}
