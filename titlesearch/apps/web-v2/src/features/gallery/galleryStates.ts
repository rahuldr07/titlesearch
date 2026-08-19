/**
 * The catalogue itself.
 *
 * DELIBERATELY LOCAL CONSTANTS, and this is not a contract gap. Every other
 * screen renders server state; this one renders the DESIGN'S OWN inventory of
 * edge states, which is documentation about the UI rather than data about an
 * order. Fetching it would be inventing an endpoint whose payload could only
 * ever be this list, and would let the catalogue drift out of sync with the
 * thing it catalogues.
 *
 * It is ordered by PIPELINE STAGE — intake, completeness, review, document,
 * post-delivery — not by severity. Reading top to bottom walks an order through
 * the system, which is how someone checks that the states stay distinguishable
 * from each other at the moments they actually appear next to each other.
 *
 * `accent` is the four-state semantic register, never a hue: settled = done,
 * halt = stopped and actionable, attend = look at this, action = a person acted.
 * A card whose accent is wrong is a worse defect than a card that is missing,
 * because the gallery is what everything else is checked against.
 */

export type GalleryAccent = "settled" | "halt" | "action" | "attend";

export interface GalleryState {
  id: string;
  /** Which stage of the pipeline draws this state. */
  tag: string;
  title: string;
  desc: string;
  accent: GalleryAccent;
  /** The badge the real screen would show. */
  badge: string;
  body: string;
}

export const GALLERY_STATES: readonly GalleryState[] = [
  {
    id: "gate-silent",
    tag: "Completeness",
    title: "Gate passes silently",
    desc: "No gaps — the run continues without a stop.",
    accent: "settled",
    badge: "Passed",
    body: "Every claim matched a segmented document. The gate leaves no screen to clear.",
  },
  {
    id: "gate-one-gap",
    tag: "Completeness",
    title: "One gap",
    desc: "A single claim the package contradicts.",
    accent: "halt",
    badge: "Package incomplete",
    body: "“You said judgments were run.” No name-search result was segmented. The run halts.",
  },
  {
    id: "gate-several-gaps",
    tag: "Completeness",
    title: "Several gaps",
    desc: "More than one contradiction at once.",
    accent: "halt",
    badge: "3 gaps",
    body: "Deed, chains and 20-year span all fail. Each gets its own card; all must close.",
  },
  {
    id: "gap-closed-upload",
    tag: "Completeness",
    title: "Gap closed by upload",
    desc: "A supplementary PDF attaches to the package.",
    accent: "settled",
    badge: "Closed · added",
    body: "judgment_search.pdf (3 pages) attached — package grows, nothing replaced.",
  },
  {
    id: "gap-closed-amend",
    tag: "Completeness",
    title: "Gap closed by amend",
    desc: "YES → NO on a signed assertion.",
    accent: "action",
    badge: "Closed · amended",
    body: "Amended from YES → NO. The change and the original are both kept on the record.",
  },
  {
    id: "claimed-no-present",
    tag: "Review",
    title: "Claimed NO but present",
    desc: "Inverse mismatch — not blocking.",
    accent: "attend",
    badge: "Note only",
    body: "Claimed NO on chains, but a prior deed is in the package. Surfaced as a review note.",
  },
  {
    id: "supplementary-rejected",
    tag: "Completeness",
    title: "Supplementary fails validation",
    desc: "The added PDF can’t be read either.",
    accent: "halt",
    badge: "Upload rejected",
    body: "judgment_search.pdf is password-protected. Gap stays open until a readable file is added.",
  },
  {
    id: "empty-queue",
    tag: "Intake",
    title: "Empty queue",
    desc: "No order assigned.",
    accent: "settled",
    badge: "Idle",
    body: "No order is assigned to you. The reviewer isn’t idle-scored for it.",
  },
  {
    id: "all-answered",
    tag: "Review",
    title: "Every decision answered",
    desc: "Finalize unlocks.",
    accent: "settled",
    badge: "Ready",
    body: "All decisions answered; the stamp flips to Ready and Finalize enables.",
  },
  {
    id: "page-not-captured",
    tag: "Document",
    title: "A page that wasn’t captured",
    desc: "Says so plainly.",
    accent: "action",
    badge: "p41",
    body: "“Not read in full. The classifier found nothing here the report needs.” Never a silent blank.",
  },
  {
    id: "corrected-v2",
    tag: "Post-delivery",
    title: "Corrected v2",
    desc: "An amended sheet reissues.",
    accent: "action",
    badge: "v2",
    body: "Grantee corrected after delivery. v1 retained; client notified of the amended sheet.",
  },
];
