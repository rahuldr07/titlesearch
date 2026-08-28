/**
 * THE LIFECYCLE BOARD'S READ — and it is a RE-EXPORT rather than a declaration,
 * which is the whole content of this file.
 *
 * `accountQueries.ts` is the shape this follows: a `shared/` module that
 * carries the DESCRIPTION of a read and never performs one, because
 * `check-rules.mjs`'s `presentational-fetches` keeps `@tanstack/react-query`
 * out of `shared/` entirely. `app/useRead.ts` is the three lines that fetch.
 *
 * ══ WHY NOTHING NEW IS DECLARED HERE ═══════════════════════════════════════
 *
 * `/api/lifecycle` already has a descriptor — `queries.ts:70`, written for the
 * overview, which prints the same four census figures this screen does. A
 * second `{ path: "/api/lifecycle", key: ["lifecycle"] }` spelled out here
 * would be the defect `queries.ts` names in its own header: "two features
 * naming a key slightly differently are two caches, and two caches of one
 * response fail silently, as a refetch nobody asked for and a stale value
 * nobody can explain." Rule 11 states it for numbers — one variable, never two
 * literals — and a path is no different.
 *
 * So the dashboard layer gets its own module, as asked, and that module's
 * honest content is a pointer. The re-export keeps `features/dashboard`
 * importing from a dashboard-shaped surface without minting a second spelling
 * of a read that already exists.
 *
 * ══ WHAT THE BOARD MAY DO WITH IT ══════════════════════════════════════════
 *
 * `LifecycleResponse` (`intake.ts:246`) carries `scope_note`, four integers,
 * and seven stages. EVERY figure on it is the server's. `LifecycleStage.count`
 * is explicitly NOT `orders.length` (`intake.ts:217-222`): the order list is
 * scoped to what the caller may see and the census is not, so a count taken
 * from the list would shrink with the reader's permissions and read as work
 * disappearing rather than as work they cannot look at.
 *
 * `/api/metrics` is deliberately not reachable from here and is not added: it
 * carries `median_minutes_per_order`, a pace indicator, and INVARIANT 23 plus
 * AGENTS.md ban throughput and timers "anywhere". A board is a census of what
 * is left, never a rate.
 */
export { lifecycle } from "./queries";
