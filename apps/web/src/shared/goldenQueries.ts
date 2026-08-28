import { GoldenResponse, type GoldenField } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/**
 * THE GROUND-TRUTH CORPUS, AS A READ DESCRIPTOR.
 *
 * Same rule as `queries.ts` and `accountQueries.ts`: this file carries the
 * DESCRIPTION of a read and performs none, because `check-rules.mjs`
 * (`presentational-fetches`) keeps `@tanstack/react-query` out of `shared/`.
 * `app/useRead.ts` is the three lines that fetch.
 *
 * ══ WHY IT IS ITS OWN FILE ═════════════════════════════════════════════════
 *
 * `queries.ts` is the PIPELINE — the queue, an order, its fields, its census.
 * `accountQueries.ts` is the shop's ADMINISTRATION. The golden set is neither:
 * it is the measuring instrument the pipeline is graded with, and it is read by
 * two screens (`/golden` and `/seed-correction`) that `check-rules`'
 * `cross-feature-import` rule forbids from importing each other. Without one
 * spelling here they would carry two paths and two cache keys for one corpus,
 * which is rule 11's "one variable, never two literals" applied to a cache —
 * and it fails silently, as a seed-correction screen showing a row the golden
 * screen has already changed.
 *
 * ══ WHAT IS DELIBERATELY ABSENT ════════════════════════════════════════════
 *
 * THERE IS NO SUMMARY DESCRIPTOR, because there is no summary endpoint and
 * there must not be one. AGENTS.md's anti-pattern list bans an aggregate
 * accuracy headline, and `endpoints.ts:336-339` makes the same refusal
 * structural on the bench shape: "the two axes are the finding; there is
 * deliberately NO aggregate number in this shape". A `goldenAccuracy`
 * descriptor here would be the first line of the headline this product exists
 * without.
 *
 * The three golden WRITES are absent for the ordinary reason: a descriptor
 * describes a read. `POST /api/golden/corrections`, `/{id}/confirm` and
 * `/{id}/demote` are spelt in the features that perform them, where the
 * mutation and its refusal live together.
 */

/**
 * `GET /api/golden` — the whole corpus, in one read.
 *
 * Typed structurally rather than as `GoldenResponse`, for the reason
 * `accountQueries.ts` records about `RulesResponse`: `endpoints.ts:622` exports
 * the SCHEMA under that name and no inferred type beside it, unlike every
 * neighbouring shape. `packages/contract` is frozen, so the type is spelt from
 * the `GoldenField` the contract does export rather than by adding an alias to
 * a package this app does not get to edit.
 *
 * It returns everything and takes no filter, and that is right rather than
 * lazy: the corpus is the reference document a correction is argued against,
 * the same way `/api/rules` returns the rulebook whole. Nothing about reading
 * it hands out work, so `INVARIANTS:22` — the queue's refusal to be browsed —
 * does not reach it.
 */
export const goldenSet: ReadDescriptor<{ golden_fields: GoldenField[] }> = {
  path: "/api/golden",
  key: ["golden"],
  schema: GoldenResponse,
};
