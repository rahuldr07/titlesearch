# apps/web — the rebuild plan

## What I verified before writing this (not assumed)

1. `shadcn@4.19.0 init --base aria --preset nova` WORKS. Ran it in /tmp/scprobe.
2. `shadcn add` on the aria base produced 13 components, **12 of 13 genuinely on
   react-aria-components** (badge is a plain div, correctly).
3. Registry idiom against your rules, MEASURED on those 13 files:
   - 19 `dark:` variants  (this app has no dark register)
   - 54 arbitrary values  (check-rules bans them)
   - 25 off-scale `text-xs/sm/base/lg` (rule 2 allows SIX sizes: 11/13/16/20/28/40)
   - 3 of 13 files over 150 lines
   - 1,304 lines total
4. Registry Button is `h-8` (32px), `rounded-lg`. **Design system says 38px, radius 14.**
   Registry has 6 variants; the design system names 4 (primary/secondary/ghost/disabled).

## The honest conclusion

shadcn gives a real head start on STRUCTURE — correct react-aria wiring, slots,
data-attributes, composition. It does NOT give you this design. Every file needs
its class strings rewritten to the recipes, and the review already found the
places that matters.

So: **generate with shadcn, then adapt.** Not hand-write. Not ship raw registry.
And record it, so the next reader knows which is which.

## Salvage ledger — what moves from web-v2 to web

| From web-v2 | Verdict | Why |
|---|---|---|
| `e2e/invariants/` (18 specs, ~90 tests) | **MOVE UNCHANGED** | The closed loop. Assertions never change. |
| `e2e-live/` (5 specs) | **MOVE UNCHANGED** | Proves it reaches core-api and halts without it. |
| `src/shared/` (12 files) | **MOVE** | provenance/fieldValue, focusOwnership/focusRoles, api, session, notify, crash, crashRedaction, date. All survived review B1–B4 and were FIXED. This is the layer that earned its place. |
| `src/entities/` (17) | **MOVE, then re-point** | Domain components. shadcn has no opinion on a ProvenanceTag. They import from components/ui, so imports get rewritten. |
| `scripts/check-rules.mjs` (376 lines) | **MOVE + FIX B3** | Gate. Review found a 7th type size reachable 4 ways it does not catch. |
| `e2e/helpers/axe.ts` | **MOVE** | The a11y gate, with the proven-failing test. |
| `vite.config.ts`, `eslint.config.js`, `knip.json`, tsconfigs, `.storybook/` | **MOVE + adapt** | React Compiler, motion ban, size-limit shell glob, PDF chunk split. Hard-won. |
| `src/components/ui/` (22) | **REGENERATE** | This is the shadcn skip. Replace with registry output adapted to the recipes. Keep `disabled.ts` (rule 9 as a type — the registry has no equivalent) and `cx.ts`. |
| `src/app/` (19) | **MOVE, then re-point** | Shell, routing, chords, palette, keymap. Routes copied from the frozen door table. |
| `src/features/signin/` | **MOVE** | The one real screen. |
| `src/workbench/` | **MOVE** | The demo page. Add the domain half. |
| `components.json` | **REGENERATE** | Currently describes a setup nobody performed. |
| `BRIEF.md` / `BRIEF-DELTAS.md` | **MOVE** | Classed RECORD in docs/INDEX.md — verbatim, never edited. |

## Order of work

**A. Prove the target (before deleting anything)**
1. Scaffold `apps/web` — Vite 8, React 19, TS 6, Tailwind v4, workspace wiring.
2. `shadcn init --base aria --preset nova`, for real, committed with the command in the message.
3. `shadcn add` the full set. Commit RAW REGISTRY OUTPUT as its own commit, so the
   adaptation diff is reviewable forever.
4. Port tokens from `TitlePipe-Design-System.html` §8 (copy verbatim, it says so).
5. Adapt the kit to the §6 recipes. Delete `dark:`, replace arbitrary values,
   collapse to six type sizes, apply 38px/radius-14 buttons, forbid nested cards.
6. Re-add `disabled.ts` (rule 9 as a type) and the chord-scope markers.

**B. Move what survived**
7. shared/ → entities/ → app/ → features/ → workbench/, re-pointing imports.
8. e2e + e2e-live + helpers, unchanged.
9. Gates: check-rules (+ the B3 fix), eslint, knip, size-limit, axe, storybook.

**C. Close it out**
10. Delete `apps/web-v2`. Update every reference (README, docs, workflows, CI).
11. Verify: typecheck, lint, build, check-rules, storybook, workbench, axe.
12. Visual diff the workbench against `TitlePipe-Design-System.html` §6 recipes.

## What I will NOT do without asking
- Change any assertion in `e2e/invariants/`.
- Touch `packages/contract`.
- Amend AGENTS.md or INVARIANTS.md. (An agent did that twice today; both reverted.)
