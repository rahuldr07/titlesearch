/**
 * The notification boundary.
 * `sonner` is named HERE and nowhere else in the application. Owner ruling,
 * 2026-08-27; the acceptance criterion is mechanical and lives in the
 * dependency spec:
 *     grep -rn "sonner" apps/web-v2/src   →   exactly one file
 * The reasoning, from the spec: the toast vendor is the single most
 * fashion-driven choice in the manifest. An adapter makes replacing it a
 * one-file change instead of a sweep. That is cheap insurance, not ceremony.
 * WHAT DOES NOT BELONG HERE. Refusal text. `INVARIANTS:58-59` — a refused
 * mutation surfaces the SERVER's message verbatim; the client never authors
 * the wording. So these functions take a string and show it; they never
 * compose one, never prefix "Error:", never add a period. If you find yourself
 * wanting to improve the server's sentence, the improvement belongs in the
 * server.
 */

import { toast } from "sonner";

/**
 * Show a message the server produced.
 * `message` is rendered verbatim in every case. The variant chooses colour and
 * icon; it never edits the words.
 */
export const notify = {
  /** A thing happened and the record now says so. */
  success(message: string): void {
    toast.success(message);
  },

  /**
   * A refusal. The server's message, unedited.
   * Not `duration: Infinity` — a refusal the reviewer cannot dismiss is a
   * refusal that blocks the next attempt. The screen, not the toast, carries
   * the durable state of a refused action (`INVARIANTS:65-66`: the field
   * repaints as the server has it).
   */
  error(message: string): void {
    toast.error(message);
  },

  /** Something needs looking at, and nothing has failed. */
  warning(message: string): void {
    toast.warning(message);
  },

  info(message: string): void {
    toast.info(message);
  },

  /**
   * A pending mutation. The three strings are UI copy, not server output —
   * this is the one place that is legitimate, because no server has answered
   * yet at the moment "Saving…" is shown.
   * `error` takes the server's message from the rejection, so the failure
   * branch stays verbatim.
   */
  promise<T>(
    work: Promise<T>,
    copy: { loading: string; success: string; error: (reason: unknown) => string },
  ): void {
    toast.promise(work, copy);
  },

  dismiss(): void {
    toast.dismiss();
  },
};

/**
 * The toast host. Mounted once, at the app root.
 * `hotkey` is set away from sonner's default (`altKey+T`) and away from every
 * chord in the single-key vocabulary — see `shared/chords.ts`. Sonner exposes
 * it as `hotkey?: string[]`, so this is a supported setting rather than a
 * workaround.
 * Accessibility is why sonner survived evaluation: it renders
 * `aria-live="polite"`, `aria-relevant="additions text"`, `aria-atomic="false"`
 * — correct for WCAG 2.2 §4.1.3 Status Messages, which is exactly the
 * criterion `@axe-core/playwright` cannot detect the absence of.
 */
export { Toaster } from "sonner";
