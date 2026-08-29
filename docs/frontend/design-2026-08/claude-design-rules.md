# TitlePipe — design rules for coding agents
Paste this file into the implementing repo (e.g. CLAUDE.md section) alongside tokens.css / tokens.json.

1. Spend the accent (--accent #5B4B8A) once per screen: the open decision or the single primary action. Everything else graphite.
2. Six type sizes only: 11 / 13 / 16 / 20 / 28 / 40 px. Nothing between.
3. Mono (--font-data) is for data only: order refs, money, citations, hashes, timestamps, kbd. Never labels, buttons, prose.
4. Sentence case everywhere. ALL-CAPS only: sidebar rubrics (11px, .14em) and serif certificate headings.
5. Radii: 14px surfaces, 10px inputs, 6px inside 10px wrappers (inner = outer − gap), 999px pills, ~0 on paper.
6. One status signal per table row — a mark (✓ ◆ •) + weight. Colored capsules only at moments of record (released, quarantine clear, T1).
7. No gradients, no emoji, no icon soup. Flat brand mark. Glyph vocabulary: ✓ ◆ • T1.
8. Evidence and deliverables render as paper (--paper-*): serif, warm stock, clerk stamps, justified text. Never grey placeholder bars.
9. Every disabled control states its reason (title attr or inline note), e.g. "Blocked: T1 second read not countersigned."
10. Motion: 140ms ease on state; 260–300ms cubic-bezier(.32,.72,0,1) on entry/movement. Nothing bounces.
11. Numbers reconcile across screens — one variable, never two literals.
12. Roles gate actions server-side and visibly: blocked actions render disabled with the rule, not hidden.
13. Second read: a T1 countersign must come from a different user than the ruling examiner (enforce with a 409, not button state).
14. Absence is typed (4-state NA taxonomy), never a blank: structurally absent / not found in package / not stated in instrument / page unreadable.
