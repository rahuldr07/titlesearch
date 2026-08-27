/**
 * RULE 9, AS A TYPE.
 *
 * "Every disabled control states its reason." That rule has been written down
 * four times and enforced zero times, because `disabled` is a boolean and a
 * boolean cannot carry a sentence. So this kit HAS NO BOOLEAN DISABLED PROP.
 *
 * Every control below omits react-aria's `isDisabled` from its public props and
 * exposes `disabledBecause?: string` instead. The consequences are the point:
 *
 *   <Button disabled>            → type error: unknown prop
 *   <Button isDisabled>          → type error: excess property, `isDisabled` is Omit-ed
 *   <Button disabledBecause="">  → passes tsc, and is caught by review — an
 *                                  empty string is the one hole, and closing it
 *                                  with a template-literal brand made every
 *                                  call site that computes a reason from server
 *                                  text fail to compile, which is worse.
 *
 * `null` and `undefined` both mean ENABLED, so a caller may write
 * `disabledBecause={blocker?.message}` without a ternary. That matters more
 * than it looks: the ternary is where a reason gets dropped.
 *
 * ALSO RULE 12. "Blocked actions render disabled with the rule, not hidden."
 * The reason is put on `title` (hover) AND `data-disabled-reason` (Playwright,
 * and `e2e/invariants` asserts against it) AND, where the control has a
 * description slot, inline. A tooltip alone fails WCAG 2.2 on touch.
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
 * The NATIVE half of the same idea, and the reason it exists is a bug that
 * shipped past four green gates.
 *
 * `react-aria-components`' `Input` and `TextArea` are NOT composites. They are
 * thin wrappers over `<input>` / `<textarea>`, and their props interface is
 * `Omit<InputHTMLAttributes<HTMLInputElement>, …>` — there is no `isDisabled`
 * prop at all. Verified in the installed source:
 *
 *     dist/private/Input.mjs:33   isDisabled: props.disabled
 *     dist/private/Input.mjs:56   "data-disabled": props.disabled || undefined
 *
 * So `{...disabledAttributes(reason)}` on an `Input` passed an unknown key
 * straight through to the DOM. React warned; nothing else did. Measured: the
 * control stayed LIVE and accepted typing, while still rendering the `title`
 * and the `data-disabled-reason` attribute the invariant specs assert against.
 * A gate green on a refusal that refused nothing.
 *
 * It also never received `data-disabled`, so every `data-disabled:` class in
 * `field-chrome.ts` was dead and a blocked field did not even LOOK blocked.
 *
 * The two functions are deliberately separate rather than one that guesses.
 * A component author knows whether they are wrapping a composite or an
 * element; a helper inspecting its own arguments does not, and would fail the
 * same way silently the first time react-aria changed a primitive.
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
