# Component recipes — extracted from `TitlePipe-Design-System.html` §6

Exact values, quoted. This is what the registry output is adapted TO.

| Component | Geometry | Spec, verbatim |
|---|---|---|
| **Buttons** | **38px tall, radius 14** | Primary `#5B4B8A` (**one per view**); secondary white + `#D6D9E1` border; ghost borderless `#454A55` w500; disabled `#E4E7ED`/`#8A8E98` with `cursor:not-allowed` **AND a `title=` stating the reason**. Hotkey hints inline at .5–.6 opacity: "Confirm C". |
| **Inputs** | **36–38px, radius 10** | `#FBFBFD` fill, `#D6D9E1` border, 13px. Data values in mono. Read-only fields keep `#6E7480` text and explain themselves (e.g. "— read from clerk stamp"). Labels: 11px w700 grey above. |
| **Pills / kbd / tier** | 999px | Pills 999px **only** for kickers, role badges, hotkey chips, T1. A table row carries **at most ONE** status signal — weight and position first, capsule last. |
| **Card** | radius 14 | White, `#E4E7ED` border, card shadow. Header row: 11px w700 `#8A8E98` sentence case on `#FBFBFD` with `#EDEFF3` rule. Rows separated by hairlines; 16–24px padding; **nested cards forbidden**. |
| **Open decision** | 3px left rail, **no fill box** | 3px `#5B4B8A` left rail. Field name 13px accent; value 20–28px w600; second reading inline; consequence in amber words. Actions: one primary + ghosts. **The only accent-dominant element on the screen.** |
| **Paper — scans** | rotate(−.35deg) | `#F7F5EF`, serif, justified, clerk stamp rotated −3.5deg `#7C6A55` at .8 opacity, grain gradients, citation boxes 1.5px `#5B4B8A` over `rgba(91,75,138,.13)`. |
| **Paper — certificates** | — | `#FDFCFA`, roman-numeral ruled heads, uppercase .1em serif titles, DRAFT/INTERNAL watermark at `rgba(20,22,28,.05)` rotate(−16deg). |

## Elevation
- Card `0 1px 2px rgba(20,22,28,.04), 0 10px 28px rgba(20,22,28,.06)`
- Modal `0 24px 60px rgba(0,0,0,.3)` + `rgba(20,18,30,.45)` blurred scrim
- Paper `0 1px 2px rgba(0,0,0,.18), 0 10px 26px rgba(0,0,0,.13)` + rotate(−.35deg)

## Where the registry disagrees, and ours wins

| | Registry (raw) | Design system |
|---|---|---|
| Button height | `h-8` = 32px | **38px** |
| Button radius | `rounded-lg` = 8px | **14px** |
| Button variants | 6 (default/outline/secondary/ghost/destructive/link) | **4** (primary/secondary/ghost/disabled) |
| Type scale | `text-xs/sm/base/lg` | **six sizes only**: 11/13/16/20/28/40 |
| Dark | 71 `dark:` variants | **no dark register** — dark is CHROME (rail, login, code), not a theme |
| Nesting | Cards nest freely | **nested cards forbidden** |

## The 12 rules vs the 14

`claude-design-rules.md` carries 14; this page carries 12. They do not conflict —
rules 1–12 are **identical in both**. The design-rules file adds two the visual
spec has no reason to state:

- **13.** A T1 countersign must come from a different user than the ruling examiner (enforce with a 409, not button state).
- **14.** Absence is typed (4-state NA taxonomy), never a blank.

Both are domain rules, both are already enforced in `packages/contract` and
`src/shared/fieldValue.ts`. Nothing to reconcile.
