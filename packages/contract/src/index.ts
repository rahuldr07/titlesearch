/**
 * @titlepipe/contract — the shared source of truth for the REST contract.
 *
 * Zod schemas consumed by apps/web (forms, TanStack Query), packages/mocks
 * (MSW handlers), and eventually core-api directly (no codegen).
 *
 * The authoritative prose contract is docs/CONTEXT.md §7 + docs/PRD.md §9.
 * Server-side owns all state machines, needs_review logic, queue ordering,
 * derived values, and blindness enforcement. Screens are thin.
 */
export * from "./enums.js";
export * from "./entities.js";
export * from "./endpoints.js";
export * from "./authz.js";
export * from "./workspace.js";
export * from "./intake.js";
export * from "./design.js";
export * from "./design2.js";
