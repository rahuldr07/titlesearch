# Confidence audit — what I actually verified, 2026-09-01

Thirteenth companion to `LEAD-MEASUREMENTS-2026-09-01.md`, and the least
comfortable. I marked seven research items `verified`. Re-testing each against
the evidence I actually hold, **four of those were overstated.** This file
records the correction and the one real finding the re-check produced.

The distinction being applied:

- **verified** — I ran a command against the real thing and read the result.
- **validated** — I read the authoritative source carefully and cross-checked
  it, but nothing executable exists to run.

---

## Overstated, and why

### 1. "Full contract surface: every endpoint, **request/response schema**, and refusal"

`endpoints.ts` defines 54 exported zod schemas — and the contract as a whole defines **171** (`CONTRACT-SCHEMA-INVENTORY`, which corrects this section's own undercount). `ENDPOINT-RECONCILIATION`
enumerates **paths** — which of ~70 are live, dead or proof-bearing — and
`MSW-BEHAVIOUR-HARVEST` captures the twelve refusal sentences verbatim.

**Neither documents the 54 request/response shapes.** The path inventory is
verified; the schema inventory was never done. A plan task that says "implement
`POST /api/fields/{id}/correct`" still has to open `endpoints.ts` to learn what
the body is.

→ **validated**, and the schema-by-schema inventory is genuinely outstanding.

### 2. "Inventory the Flask prototype: what must be ported"

I established the archive is **absent** (`verify_archive.py` →
`archive not found`). That is the opposite of inventorying its contents. I
could not read one line of `assemble.py`.

→ **validated** for the *absence* claim, which is solid; the *inventory* is
not done and cannot be from this host. See §"the one real finding" below for
what the manifest does yield.

### 3. "Design the real data model vs the skeleton schema"

`SCHEMA-GAP` measures a gap: 32 columns exist, ≥141 needed, ten tables missing.
Grep across all thirteen documents finds **zero proposed `CREATE TABLE`,
`ADD COLUMN` or `sa.Column` lines.** No model was designed. Measuring a gap and
designing the thing that fills it are different tasks and I conflated them.

→ **validated** as a gap analysis. The design is Plan 04's work, unstarted.

### 4. "Research extraction ensemble, adapters, cost/latency, object store, queue"

`PIPELINE-RESEARCH` is a careful reading of `CONTEXT §5/§6/§8`. Nothing in it
was executed, because **nothing is built to execute**: `procrastinate` is
pinned in zero of four service `pyproject.toml` files, and `settings.py` has no
storage configuration at all.

The two checks I *did* run — that the queue is unpinned and the store
unconfigured — are verified and are themselves findings. The architecture
summary is a reading.

→ **validated.**

## Correctly marked verified

| item | the executable evidence |
|---|---|
| current backend state | `pytest` 249, `ruff`, `check_backend_rules` 54 files, `wc -l` per service |
| endpoint reconciliation | three greps over three sources: 41 / 70 / 44 / 1 |
| archive absent | `verify_archive.py` printed `archive not found` |
| rules + invariants mapping | 68 classified by hand with set arithmetic; grep proved 0 of R1–R24 enforced in `services/`, `libs/` **and** `apps/web/src` |
| identity/authz | counted 44 actions / 19 doors / 9 dead from `authz.ts` (first reported 47 — see the addendum); read all three `admin`-on-missing-header defaults; confirmed `workos` in no lockfile |
| live harness broken | drove a real production build; `/rulebook` renders "Nothing lives at this address" |
| live DB verification | queried `information_schema`, `pg_class`, `pg_roles`, `pg_enum` on the running container |
| compliance | mixed: the built controls were read in source and their tests run; the **unbuilt** obligations are a reading |

## The one real finding this re-check produced

Pushing on claim 2 rather than just downgrading it: **`GATE_0_ARCHIVE_MANIFEST.md`
carries filenames and byte sizes**, so a port-effort inventory *is* derivable
from this host even though the source is not readable.

Package modules by size:

```
api.py 19458   assemble.py 17397   golden.py 16841   render.py 16397
segment.py 14090   inbox.py 13434   seed.py 11647   models.py 10793
validators.py 9080   ingest.py ~     __init__.py ~
```

Totals: **src 134,644 bytes · tests 68,673 · bugfix patches 26,084.**

Two things follow that no document currently states:

**The port surface is wider than `HANDOFF §2` lists.** HANDOFF names eight
modules: `models`, `validators`, `segment`, `assemble`, `render`, `api`,
`ingest`, `golden`. The archive also contains **`inbox.py` (13,434)** and
**`seed.py` (11,647)**, plus `tools/seed_golden.py` (15,960) — roughly **41 kB
of unlisted code**, a quarter of the package. Any port estimate built from
HANDOFF's module list is short by that much.

**`assemble.py` is 17,397 bytes against `validators.py`'s 9,080.** The document
that warns *"assemble is the expensive stage, budget it as its own stage"* is
corroborated by the artefact: assembly is nearly twice the validators, and its
test file (`test_assemble.py`, 15,655) is the largest in the suite. That is
independent support for `BACKEND-MASTER-PLAN`'s decision to give Plan 08 its
own plan.

**And `spec.md` is in the archive at 54,315 bytes** (manifest line 49),
confirming `RULES-AND-AUTHZ-VALIDATION §1`: the per-rule provenance tags travel
with G2. Recovering the archive recovers the tags.

## What this changes

No conclusion in the master plan moves. The sequencing, the six gates and the
~47-endpoint target all stood up. What changes is the **confidence label on
four research items**, and the addition of a port inventory that was derivable
all along from a file already in the repository.

The lesson for the next reader is narrow and worth stating: **"I could not read
the source" is not the same as "there is nothing to learn about the source."**
A hash manifest is still evidence.
