import type { MouseEvent } from "react";

/**
 * IS THIS THE CLICK THE APP SHOULD HANDLE, or the one the BROWSER should?
 *
 * A link that navigates through a router callback has to answer that question
 * before it calls `preventDefault`, and getting it wrong is invisible in every
 * test: ⌘-click, ctrl-click, shift-click and middle-click all still fire a click
 * handler, so a component that swallows them unconditionally looks perfectly
 * correct until somebody tries to open a nav row in a new tab and the app
 * navigates the current one instead.
 *
 * RULE: only an UNMODIFIED PRIMARY click belongs to the app. Everything else is
 * left alone so the element's real `href` does what the browser promised —
 * new tab, new window, download, whatever the user asked for. FAILURE
 * PREVENTED: a navigator of links quietly degrading into a navigator of
 * buttons.
 *
 * `button !== 0` covers middle-click, which is the most common way anybody opens
 * a nav item in a background tab and the one most often forgotten, because it
 * does not involve a modifier key at all.
 *
 * Its own module rather than a method on the one component that needs it today:
 * this is a fact about how links work, not about how a rail row looks, and the
 * next link in this codebase that routes through a callback should not have to
 * rediscover the middle-click clause.
 */
export function isPlainClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}
