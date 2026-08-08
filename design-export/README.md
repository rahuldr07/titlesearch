# design-export — the 2026-07-28 Claude Design package, as text

`TitlePipe.dc.html` (declarative `.dc` markup, 3,536 lines) and `support.js` (the
runtime that interprets it) are the contents of the Claude Design export
`TitlePipe reviewer flow.zip`, extracted 2026-08-08 so the design of record is
tracked as reviewable text instead of an archive the client-data guard refuses.

What the archive also contained, and where it went (all preserved in git history
before commit `ed6df25`'s escalation was resolved):

| Entry | Disposition |
|---|---|
| `TitlePipe reviewer flow.html` | dropped — a self-extracting wrapper embedding this same zip as base64 (BRIEF-DELTAS D-1) |
| `.thumbnail` | dropped — SVG preview |
| `screenshots/nocard.png` | dropped — renders the export's un-certified fixture universe (the ESTRADA parties); the 2026-08-06 admission review's standard refuses it |

**Status: historical reference, not the visual target.** The approved reference
since 2026-08-01 is `docs/frontend/directions/hybrid.html` (frontend handoff §6).
This export remains the pixel/behavior spec the `apps/web-v2` rebuild was audited
against (`docs/frontend/fidelity-audit-2026-07-30.md`) and is cited by
`apps/web-v2/BRIEF.md` and `BRIEF-DELTAS.md`.

The data drawn in the markup (parties, addresses, order numbers) was invented by
the design generator — see BRIEF §10. It is not adopted as synthetic fixture data
(`packages/mocks/src/data.ts` deliberately declines it) and must never be treated
as extraction truth.
