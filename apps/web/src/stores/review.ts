import { create } from "zustand";

/**
 * The tiny zustand store — keyboard mode + open-panel state ONLY
 * (frontend-master-prompt §1). Everything else lives in the server via
 * TanStack Query. Single-key actions suspend while any input-mode panel is
 * open (`mode !== "idle"`).
 */
export type ReviewMode = "idle" | "editing" | "escalating" | "bug" | "passing";

interface ReviewUi {
  selectedId: string | null;
  mode: ReviewMode;
  /** Reading whose line coords are pinned on the page, if any. */
  pinnedReadingId: string | null;
  select: (id: string) => void;
  setMode: (mode: ReviewMode) => void;
  pin: (readingId: string | null) => void;
  reset: () => void;
}

export const useReviewUi = create<ReviewUi>((set) => ({
  selectedId: null,
  mode: "idle",
  pinnedReadingId: null,
  select: (id) =>
    set({ selectedId: id, mode: "idle", pinnedReadingId: null }),
  setMode: (mode) => set({ mode }),
  pin: (pinnedReadingId) => set({ pinnedReadingId }),
  reset: () => set({ selectedId: null, mode: "idle", pinnedReadingId: null }),
}));
