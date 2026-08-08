# Repository organization plan

**Date:** 2026-08-08 · **Status:** PROPOSED — Phase 2 items marked ⚖ need the owner's ruling; everything else is executable as written.
**Scope:** repository structure, documentation hygiene, and the tracked-binary/CI problem. **Not in scope:** any code behavior, any closed decision (ADR-0001, the reskin, the hard rules), the `web-v2 → web` rename (Phase 6 cutover owns it, BRIEF §5).

Every finding below was measured against the working tree at `ed6df25`, not inferred from the docs.

---

## 1. Findings

### F-1 — No root README

The repo has no `README.md`. The entry points are `CLAUDE.md`/`AGENTS.md` (agent guidance, byte-identical copies) and a 50-file `docs/` tree with no index. A person landing on the repository has no map.

### F-2 — Two authoritative documents are cited everywhere and exist nowhere

`docs/rulings_2026-07.md` (full text of R13–R24) and `docs/spec.md` (the 18-section extraction spec) are cited as reference-of-record by `docs/HANDOFF.md`, `docs/CONTEXT.md`, `docs/PRD.md`, both Gate 0 docs, and the Gate 0/1 execution prompt. **Neither file is in the repository.** The rulebook's full text — the product's core asset, per CONTEXT §9 — survives in VCS only inside `docs/claude rule book/Implementation_Rulebook_v1.docx`, which is one of the 13 files the client-data guard currently refuses (F-4). One escalation away from the R13–R24 text existing only on someone's machine.

### F-3 — Superseded and current docs are indistinguishable without reading both

Examples: `docs/frontend/HANDOFF-UI.md` (pre-rebuild) sits beside `HANDOFF-2026-08-01.md` (current); the backend chain `PLAN.md → BUILD-PLAN.md → IMPLEMENTATION_PLAN.md → superpowers/plans/backend/*` encodes precedence only in `.zcode/AGENTS.md`; `.zcode/AGENTS.md` itself describes the pre-rebuild world (`apps/web`, oxlint, 116 specs) and contradicts `.claude/CLAUDE.md` on the stack. `BRIEF.md` handles this correctly (kept verbatim, deltas in a sibling file) — the rest of the tree has no equivalent convention.

### F-4 — 13 tracked binaries fail the repo's own client-data guard

`git ls-files | xargs python3 scripts/check_no_client_data.py` refuses, today:

| Files | Why refused |
|---|---|
| `design-export/TitlePipe reviewer flow.zip` | archive; never inspected-and-admitted |
| `docs/claude rule book/Implementation_Rulebook_v1.docx` | not in the 2026-08-06 admission review |
| `docs/frontend/directions/{a,b,c,hybrid}-full.png` (4) | render the export's Arizona universe (ESTRADA parties, Maricopa stamp) — refused, not admitted, per the review note in `check_no_client_data.py` |
| `shots-final/design-{overview,queue,review}.png` (3) | same |
| `shots-w4/{app-delivered,design-overview,design-queue,design-review}.png` (4) | same |

These are the "13 escalated to the owner" from commit `ed6df25` and HANDOFF §10. They keep the backend workflow's client-data job red on `main`. The guard's standard is admission on evidence (hash-pinned, inspected), and that admission is the owner's to sign — see ⚖ below.

### F-5 — 8.4 MB of review screenshots tracked at the repo root, against the repo's own ignore rule

`shots-final/` (4.1 MB) and `shots-w4/` (4.3 MB) match `.gitignore`'s `/shots*/` pattern ("evidence for a review, never an artefact of the build") but were committed before the rule existed. They are `compare.mjs` output — regenerable, and permanently preserved at the review commits either way. 28 of the pairs are byte-identical across the two directories.

### F-6 — `design-export/` carries a 1.25 MB duplicate of itself

The self-extracting wrapper `TitlePipe reviewer flow.html` contains the sibling zip as base64 (BRIEF-DELTAS D-1). The directory is also superseded as the visual reference — `docs/frontend/directions/hybrid.html` is the design of record since 2026-08-01 (frontend handoff §6). The export remains a historical reference, not a target.

### F-7 — `docs/claude rule book/` has a space in its name

Every reference to it needs quoting; the allowlist in `check_no_client_data.py` pins it by literal path. Cosmetic, but it is the only directory in the tree named this way.

---

## 2. The plan

Ordered by dependency, not importance. Each phase is a separate, revertable set of commits.

### Phase 1 — Entry points and truth (no moves, no rulings needed)

1. **Root `README.md`.** What TitlePipe is (three sentences), the monorepo map, the command table (from `.claude/CLAUDE.md`), and the document authority chain: HANDOFF → CONTEXT §11 → PRD → backend/PLAN → IMPLEMENTATION_PLAN → TOOLCHAIN. Links, not copies — the authority docs stay where they are.
2. **`docs/INDEX.md`.** One row per document: path · one-line purpose · status. Status vocabulary, three values only:
   - `AUTHORITATIVE` — current source of truth for its area.
   - `RECORD` — immutable history (executed plans, session handoffs, gate closures, verbatim-as-issued prompts). Never edited, never deleted.
   - `SUPERSEDED by <path>` — kept for the citation trail.
   No document content changes. The index is the convention F-3 is missing; `BRIEF.md`/`BRIEF-DELTAS.md` already model it.
3. **Extract `docs/rulings_2026-07.md` from `Implementation_Rulebook_v1.docx`** as markdown (R13–R24 verified present in the docx body). This closes F-2's worse half with content already in the repo, makes the rulings text diffable and citable, and removes the dependency on a refused binary. `docs/spec.md` is not reconstructable from anything in VCS — record it in the index as **missing, owner to supply**, and correct the four documents that cite it only if the owner confirms it is gone.
4. **Retire or update `.zcode/AGENTS.md`.** It predates the rebuild. Either update its stack/commands sections to match `.claude/CLAUDE.md` or reduce it to a pointer. Two agent-config files disagreeing is worse than one.

### Phase 2 — Root and binary hygiene ⚖ (owner sign-off required where marked)

5. **⚖ Rule on the 13 refused binaries** (F-4). Per file: *admit* (inspect, pin sha256 + reason in `ALLOWLIST`) or *remove*. Recommendation, consistent with the guard's own review note:
   - The 7 `shots-*` files: **remove** — moot once item 6 lands.
   - The 4 `directions/*-full.png`: the four `.html` mockups beside them are the actual reference (text, diffable, admitted implicitly by extension rules); the PNGs are renders of them. **Remove the PNGs**, regenerate on demand from the HTML.
   - `Implementation_Rulebook_v1.docx`: after item 3 extracts its text, **admit by hash** as source-of-record, or remove if the markdown is ruled canonical.
   - `design-export/…zip`: **admit by hash** (it is the pixel spec of record for the pre-reskin era and is cited by BRIEF-DELTAS) — or extract `TitlePipe.dc.html` + `support.js` as tracked text and drop the zip.
   This is the single blocker for the client-data CI job on `main`.
6. **Delete `shots-final/` and `shots-w4/` from tracking** (F-5). They are review evidence, preserved at the review commits; `.gitignore` already states the policy. The 21 allowlist entries pinning their hashes go with them (the guard tolerates deletion — "deleted or renamed; nothing to admit").
7. **Drop `design-export/TitlePipe reviewer flow.html`** (F-6, the base64 duplicate). Keep the directory itself per the item-5 ruling.
8. **Rename `docs/claude rule book/` → `docs/rulebook-source/`** (F-7). Mechanical: `git mv`, update the two allowlist paths, update the three docs that reference it.

### Phase 3 — Docs restructure (mechanical, after Phase 1 lands)

Deliberately minimal. Mass-moving history breaks the SHA-and-path citations that run through every handoff, so **status is expressed in the index and in one-line banners, not by relocation.**

9. **Banner the superseded docs.** One line prepended to each `SUPERSEDED` doc: `> Superseded by <path> — kept as a record.` (`HANDOFF-UI.md`, the pre-reconciliation backend docs the index identifies, and any others the Phase 1 audit turns up). RECORD docs get no banner — their datestamps already say what they are.
10. **De-duplicate `CLAUDE.md`/`AGENTS.md` by convention, not deletion.** They are byte-identical today and will drift. Name one canonical (suggest `CLAUDE.md`), make the other's content a generated copy, and add a `diff -q` check to pre-commit so drift is a refused commit rather than a surprise.
11. **Add a doc-link check** to `scripts/`: every relative `docs/**.md` link in tracked markdown resolves to a file. F-2 is exactly the rot class this catches; today it would have failed on six documents. Wire it into the same pre-commit/CI lane as the other repo-wide scripts.

### Phase 4 — CI to green on `main`

12. After item 5, re-run the backend workflow. HANDOFF §10 records seven of twelve jobs red for reasons predating Plan 01; the client-data job is closed by Phase 2, and the remainder need individual triage — that triage is its own task, listed here only so "organized" ends at a green default branch, not at tidy directories.

---

## 3. Explicitly not doing

- **No renames under `apps/` or `packages/`.** `web-v2 → web` happens at BRIEF §5 Phase 6 cutover, not before.
- **No edits to verbatim-as-issued documents** (`BRIEF.md`, `docs/prompts/*`) — deltas files exist for that.
- **No deletion of RECORD docs**, including `docs/superpowers/plans/*` — they are the execution history the handoffs cite.
- **No relitigating closed decisions** — ADR-0001, the hybrid visual direction, the hard rules.
- **No touching the harvested invariants** in `apps/web-v2/e2e/invariants/`.

## 4. Acceptance

- Root `README.md` exists; a newcomer can find the authority chain in under a minute.
- `docs/INDEX.md` covers every tracked `.md`; no doc is ambiguous between current and historical.
- `git ls-files | xargs python3 scripts/check_no_client_data.py` exits 0.
- `docs/rulings_2026-07.md` exists and matches the docx source; `docs/spec.md` is either recovered or its citations corrected.
- No tracked path matches `.gitignore`.
- The doc-link check passes and is enforced.
- The client-data CI job is green on `main`.
