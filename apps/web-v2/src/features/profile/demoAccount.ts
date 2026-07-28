/**
 * The parts of the account screen that have no wire behind them.
 *
 * They live here, together, as obviously-synthetic constants rather than
 * scattered through the components, so that the moment an endpoint lands the
 * whole set of lies is in one file and deletes in one commit. A screen that
 * mixes real and invented values inside the same card is a screen nobody can
 * audit later.
 *
 * Nothing here is presented as a measurement, a rate or a pace — the values are
 * identity and device facts, which is the only category this screen deals in.
 */

/** A signed-in device, as the design's Security card draws it. */
export interface DemoSession {
  readonly device: string;
  readonly last: string;
  /** The session doing the looking — the design stamps it "This device". */
  readonly current: boolean;
}

/**
 * CONTRACT GAP: there is no identity endpoint. `GET /api/me/permissions`
 * answers WHAT the caller may do but never WHO they are — no name, no email,
 * no organisation. The design's identity card needs all three, and the name is
 * load-bearing beyond decoration: it is the signature on a golden correction.
 */
export const DEMO_IDENTITY = {
  name: "DEMO — A. Sample",
  email: "a.sample@demo.invalid",
  org: "Demo Organisation (synthetic)",
} as const;

/**
 * CONTRACT GAP: there is no session list and no revoke endpoint. Device, last
 * use and "is this the current session" are all server facts — a client cannot
 * know about a session it is not sitting in, so this can never be derived.
 */
export const DEMO_SESSIONS: readonly DemoSession[] = [
  { device: "DEMO — laptop · Chrome", last: "Active now", current: true },
  { device: "DEMO — tablet · Safari", last: "Last used recently", current: false },
];

/**
 * CONTRACT GAP: MFA enrolment is held by the identity provider, and nothing in
 * the contract reports it. Drawn as the design draws it — a settled dot and a
 * link out — because the provider, not this tool, is where it is managed.
 */
export const DEMO_MFA_ENROLLED = true;

/**
 * The zoom options the design offers for the document pane.
 *
 * CONTRACT GAP: there is no preferences endpoint. Preferences belong on the
 * server (they follow a person between machines) and browser storage is
 * forbidden, so the three controls on this card hold state for the life of the
 * mount and no longer. That is deliberate: a preference that silently fails to
 * persist is worse than one that visibly does not.
 */
export const ZOOM_CHOICES = ["75%", "100%", "125%"] as const;

export const DEFAULT_ZOOM = "100%";

/** Two initials for the avatar disc — a display detail, never an identifier. */
export function initialsOf(name: string): string {
  const parts = name
    .split(/[\s.]+/)
    .filter((part) => /^\p{L}/u.test(part))
    .slice(-2);
  return parts.map((part) => part.slice(0, 1).toUpperCase()).join("");
}
