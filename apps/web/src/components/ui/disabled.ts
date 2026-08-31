/**
 * This kit has no boolean disabled prop: every control omits react-aria's
 * `isDisabled` and exposes `disabledBecause?: string` instead, so a disabled
 * control always states its reason. `null` and `undefined` both mean enabled,
 * so a caller may write `disabledBecause={blocker?.message}` without a
 * ternary — the ternary is where a reason gets dropped. The reason lands on
 * `title` (hover) and `data-disabled-reason` (Playwright); a tooltip alone
 * fails WCAG 2.2 on touch.
 */

/** What every control in this kit accepts in place of a disabled boolean. */
export type Disablement = {
  /**
   * Why this control cannot be used, e.g. "Blocked: T1 second read not
   * countersigned." Absent, null or undefined means the control is live.
   *
   * The server authors this sentence whenever the server is the one refusing
   * (`shared/notify.ts` explains why the client never composes refusal text).
   */
  readonly disabledBecause?: string | null | undefined;
};

/** The DOM/react-aria props a reason expands into. */
export type DisabledAttributes = {
  readonly isDisabled: boolean;
  readonly title: string | undefined;
  readonly "data-disabled-reason": string | undefined;
};

/**
 * Expand a reason into props. Called by every control; never by a screen.
 *
 * `title` is set only when disabled, so an enabled control does not acquire a
 * stray native tooltip that would shadow a real one.
 */
export function disabledAttributes(reason: string | null | undefined): DisabledAttributes {
  const blocked = typeof reason === "string" && reason.length > 0;
  return {
    isDisabled: blocked,
    title: blocked ? reason : undefined,
    "data-disabled-reason": blocked ? reason : undefined,
  };
}

/**
 * The native half. react-aria's Input and TextArea are thin wrappers over
 * <input>/<textarea> that read `disabled`, not `isDisabled` — handed the
 * composite spelling, the unknown key goes to the DOM, the control stays
 * live, and the `data-disabled:` classes never fire. The two functions are
 * deliberately separate rather than one that guesses: a component author
 * knows whether they are wrapping a composite or an element.
 */
export type DisabledNativeAttributes = {
  readonly disabled: boolean;
  readonly title: string | undefined;
  readonly "data-disabled-reason": string | undefined;
};

export function disabledNativeAttributes(
  reason: string | null | undefined,
): DisabledNativeAttributes {
  const blocked = typeof reason === "string" && reason.length > 0;
  return {
    disabled: blocked,
    title: blocked ? reason : undefined,
    "data-disabled-reason": blocked ? reason : undefined,
  };
}
