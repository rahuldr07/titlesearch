/**
 * The notification boundary. `sonner` is named here and nowhere else in the
 * application — the adapter makes replacing the toast vendor a one-file
 * change. Refusal text does not belong here: a refused mutation surfaces the
 * server's message verbatim; the client never composes, prefixes, or edits
 * the wording.
 */

import { toast } from "sonner";

/**
 * Show a message the server produced. `message` renders verbatim; the
 * variant chooses colour and icon, never the words.
 */
export const notify = {
  /** A thing happened and the record now says so. */
  success(message: string): void {
    toast.success(message);
  },

  /**
   * A refusal — the server's message, unedited. Not `duration: Infinity`:
   * the screen, not the toast, carries the durable state of a refused action.
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
   * A pending mutation. The three strings are UI copy — legitimate here,
   * because no server has answered yet when "Saving…" shows. `error` takes
   * the server's message from the rejection, so the failure branch stays
   * verbatim.
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
 * The toast host, mounted once at the app root. `hotkey` is set away from
 * sonner's default and from every chord in the single-key vocabulary — see
 * `shared/chords.ts`. Sonner renders a correct polite live region, which is
 * a criterion automated a11y checks cannot detect the absence of.
 */
export { Toaster } from "sonner";
