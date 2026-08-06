"""Structural rules for the Python backend that no linter expresses for us.

Ruff and pyright cover style and types. These are the rules that encode what
this system is: multi-tenant, holding NPI, and answerable for every value it
emits. Each one is here because getting it wrong is a leak or an outage rather
than a mess.

## The rules

**1. `Any`, `cast(`, and every spelling of "stop checking this"** — scope
`src/`. Type erasure at a boundary is a decision; type erasure in the middle of
tenant-scoped logic is a hole with no marker on it. The rule is not "never" —
it is "not silently". The suppressions that are written as comments —
`# type: ignore`, `# pyright: ignore`, a file-wide `# pyright: basic`, a
targeted `# pyright: reportFoo=false`, and a PEP-484 type comment that says
`Any` — are the same decision spelled where the type checker reads it and the
token scan does not, so they are matched against comment text.

**2. `begin_nested(`, and `begin(` with any argument** — scope `src/`. A
SAVEPOINT is how a statement RLS refused stops being an error.

This rule used to say that a SAVEPOINT rollback unwinds the tenant GUC, and
that the next statement therefore runs under the wrong tenant. **That is
false**, and it was the stated reason for the ban for as long as the ban
existed. MEASURED against `postgres:18.4`:

    BEGIN; set_config('app.current_tenant','AAAA',true);
    SAVEPOINT sp; ROLLBACK TO SAVEPOINT sp;
    current_setting('app.current_tenant') → 'AAAA'

The mechanism half of the old sentence was right — `ROLLBACK TO` reverts a GUC
to what it held when the savepoint opened — but the conclusion drawn from it was
not, because `after_begin` sets the tenant on the *outer* transaction, so what
it held when the savepoint opened **is** the tenant. Setting one *inside* a
savepoint does unwind (`'OUTER'` → set `'INNER'` → `ROLLBACK TO` → `'OUTER'`),
and this architecture is safe from that only because the value it writes inside
is the SAME one — it does write inside; see the nested-firing measurement below.
An error inside the savepoint does not change it either: after `SELECT 1/0` and
`ROLLBACK TO`, the GUC still reads `'AAAA'`.

What a savepoint actually costs here, RE-MEASURED 2026-08-06 against
`postgres:18.4` as a non-owner login role, on a `FORCE ROW LEVEL SECURITY` table
with a `FOR ALL … USING/WITH CHECK (tenant_id = nullif(current_setting(
'app.current_tenant', true), '')::uuid)` policy, tenant A established, and a
cross-tenant `INSERT` in the middle of a batch of three:

    without a savepoint:
      row-1  ok
      cross  42501 InsufficientPrivilege
      row-3  25P02 InFailedSqlTransaction
      COMMIT -> rows committed: []
    with a savepoint around each write:
      row-1  ok
      cross  42501 InsufficientPrivilege   (swallowed by ROLLBACK TO)
      row-3  ok
      current_setting after the swallow: '11111111-1111-1111-1111-111111111111'
      COMMIT -> rows committed: [row-1, row-3]

* without a savepoint, the RLS denial aborts the transaction and **0** rows
  commit — the request fails, loudly, and somebody sees it;
* with a savepoint around the denied write, **2** rows commit, the cross-tenant
  write silently disappears, and `current_setting` still reads the right tenant.

That is the hazard: not a leak, an erasure. A SAVEPOINT is precisely the
construct for "try this, and carry on if the database refuses", and in a
tenant-scoped system carrying on after RLS refused converts a security event
into a skipped row. The ban stays, on that reason.

**THIS IS THE ONLY REASON THE BAN HAS, AND IT IS STATED HERE ONCE.** Two units
working in parallel on 2026-08-06 each concluded independently that the ban
should survive its false original justification, and each wrote a DIFFERENT
replacement reason without knowing about the other: this one, and — in
`db/session.py` — that `begin_nested` opens a nested unit of work inside a block
whose contract is "commit once on clean exit". Both are true and the erasure is
the stronger, so it leads and it is not restated elsewhere. `db/session.py` and
`tests/test_tenant_isolation.py`'s assertion 4 both now cite this paragraph
instead of arguing the ban for themselves. A rule with two reasons in two files
is a rule that gets half-repealed by whoever finds the weaker one first.

It also stays as cheap insurance on the assumption the measurement above
depends on. RE-MEASURED 2026-08-06 with SQLAlchemy 2.0.51 — one `after_begin`
handler, a `SELECT`, a `begin_nested()`, another `SELECT`, recording
`transaction.nested` at each firing:

    transaction.nested, in firing order   ->   [False, True]

`after_begin` fires for nested transactions too. So whatever the tenant handler
does, the savepoint path RE-RUNS it, and "the tenant is established once on the
outer transaction" is a live coupling between this rule and `db/session.py`
rather than a permanent fact. Measured in the same run, the two handlers that
break under a savepoint are both one edit from the real one: writing a different
value when `transaction.nested` runs every statement inside the savepoint as
somebody else (`'AAAA'` -> `'9999'` -> `ROLLBACK TO` -> `'AAAA'`, so the outer
read afterwards looks fine), and firing only when `transaction.nested` leaves
the tenant established nowhere but inside it (`''` -> `'AAAA'` -> `ROLLBACK TO`
-> `''`). Keeping the door shut costs one line of enforcement.

`begin(` with an argument is the same construct under the other name. MEASURED
with SQLAlchemy 2.0.51: `Session.begin` is `(self, nested: bool = False)` and
`session.begin(nested=True)` emits `SAVEPOINT sa_savepoint_1` — identical to
`begin_nested()`. The bare `begin()` is how every ordinary transaction opens and
is untouched; see the call-shape rule below.

**3. `text` / `literal_column` / `exec_driver_sql` / `raw_connection`, and the
classes those factories build** — scope `src/` **except** the `db` package
directly inside a distribution package. Raw SQL is how a query stops being
tenant-scoped, because the ORM's filters are what carry the scope.

`literal_column` is an exact synonym for `text` in injection terms — both splice
a string straight into the statement — and it was reachable through this gate
until it was named here. `raw_connection` is worse than either: it hands back
the DBAPI connection, so the statement leaves behind not only the ORM's filters
but the `Session` events that set the tenant GUC in the first place. It stays
under this rule, and therefore under this rule's `db` carve-out, because a pool
health check is a plausible reason to want one; that carve-out is where the
review has to actually happen.

`TextClause` and `ColumnClause` are here because banning a factory and not its
product bans a spelling. `text(x)` *is* `TextClause(x)` and `literal_column(x)`
*is* `ColumnClause(x, is_literal=True)`; importing the class from
`sqlalchemy.sql.elements` and calling it scored a clean file against this gate.
Neither name collides with an English word, so both take every shape.

A test suite legitimately needs raw SQL: proving RLS denies a row requires a
statement that deliberately reaches across a tenant. This repository's tests
live *beside* `src/` — `services/*/tests`, `libs/*/tests` — which is outside the
scan roots, so they are out of scope by **location**. A `tests` package *inside*
`src/` is a different thing and is scanned like any other: it imports and runs
like any other module, and `titlepipe_probe.tests.queries` is as much shipped
code as `titlepipe_probe.api.control`. If a `src/**/tests/` package is ever
wanted it can earn a `rules-allow-file`.

**4. `HTTPException`** — scope `src/` except each package's own `api/errors.py`.
One layer decides what a failure becomes over HTTP. Domain code that raises
`HTTPException` is domain code that cannot be called from a worker.

**4b. `JSONResponse` and the other concrete response classes** — scope `src/`
except each package's whole `api` package. Rule 4 is a rule about `raise`, and
`return JSONResponse(status_code=400, …)` makes the identical decision without
raising anything; it scored a clean file against a gate that had rule 4 in it.
Domain code that returns a response is domain code that cannot be called from a
worker, for the same reason and to the same degree.

It is a separate rule id rather than more names under `http-exception` because
its carve-out has to be wider. `api/errors.py` is the only place that decides
what a *failure* becomes, but a router returning a `FileResponse` for a rendered
report is not a failure and is ordinary FastAPI, so the exempt scope is the
whole `api` package.

Bare `Response` is deliberately **not** banned. It is the one name here that
collides: `httpx.Response` is what an engine adapter will annotate the moment
one is written, and `starlette.responses.Response` is a legitimate middleware
annotation that `api/request_context.py` carries twice today. None of the
concrete subclasses exists in `httpx`, so each of those is unambiguous. The
residual hole is named below.

It is numbered 4b rather than 5 because these numbers are cited from outside
this file — `services/core-api/tests/test_errors.py` says "rule 4" and
`services/core-api/src/titlepipe_core/db/__init__.py` says "rule 3" — and
renumbering would make somebody else's comment quietly wrong.

**5. `print`, and any write to `sys.stdout` or `sys.stderr`** — scope `src/`.
Redaction lives in the structlog chain. A `print` is an unredacted channel
straight to stdout, and it is the shortest path from a debugging session to NPI
in a log aggregator.

`sys.stdout.write(v)` is that same channel and was not `print`, so it scored a
clean file. The rule is therefore about the stream and not about the method:
`.write`/`.writelines` on a base whose dotted spelling contains `stdout` or
`stderr`. Banning `.write` broadly is unworkable — a real file, a `pathlib`
`write_text`, a subprocess `stdin` are all ordinary — and banning `sys.stdout`
outright would flag the sanctioned path, because
`structlog.PrintLoggerFactory(file=sys.stdout)` is how four telemetry modules in
this tree write their *already redacted* output. Both of those shapes are tested
as near-misses.

It reports under the `print` rule id rather than a new one, because it is one
decision. An author with a reason writes the reason once.

**6. file > 400 lines** — scope `src/`. A cap, not a target. Reviewability is
the control this whole repository leans on.

This file is itself over the cap and does not carry an exemption, because it is
not in the cap's scope: the scan roots are `services/*/src` and `libs/*/src`,
and `scripts/` is neither. That is an accident of scoping rather than a
judgement, so it is written down here beside the rule. A gate that visibly
breaks its own rule without saying so is a gate people stop believing, and the
honest position is that this file would need a `rules-allow-file(file-length)`
the day `scripts/` came into scope.

**7. a `rules-allow` whose reason is under 12 characters, or which does not
name a rule** — every scanned file. An exemption without a reason is a deletion
with extra steps.

## Why this parses instead of grepping

A substring search for `text(` matches `scrub_text(` — which
`libs/domain/src/titlepipe_domain/redaction.py` contains four times — and a
search for `Any` matches `Anything` and the word "Any" starting an English
sentence in a comment. Both were true of this tree on the day the rule was
written.

So the scan parses the file instead. That gets word boundaries for free and,
more importantly, means **comments and docstrings are not code**.
`libs/domain/src/titlepipe_domain/errors.py` opens by promising that domain
code "never raises `HTTPException`" and
`services/core-api/src/titlepipe_core/settings.py` has a comment beginning
"Any of them in a deployed …". A rule that flags the sentence documenting the
rule is a rule that teaches people to stop writing the documentation.

The scan runs twice over each file, because the two things it looks for live
in different places:

* **`ast`** for the banned names. An earlier version matched a NAME token
  followed by a `(` token, which is a rule about *adjacency* rather than about
  meaning, and a one-token rename walked straight through it:
  `from sqlalchemy import text as sql` is not merely an evasion, it is the
  conventional SQLAlchemy import, and `_emit = print` is a rename a tired
  person writes by accident. Neither has a `(` after the banned name. The AST
  knows that a name bound by an import is the imported thing however it is
  later spelled, so the import is where the rule fires.
* **`tokenize`** for the comment rules and the `rules-allow` machinery.
  Comments are not in the AST at all, and `# type: ignore` is a suppression
  that *is* a comment.

The cost of parsing is that a banned name hidden inside a string literal —
`def f() -> "Any"` — is not seen. It is a cost worth paying: using `Any`
requires importing it, and the import is code.

## Exactly which node shapes fire, and which deliberately do not

`text` is an ordinary English word, `print` is a verb, and `cast` is what you
do to a vote. A rule that fires on every occurrence of a common identifier is
a rule that gets switched off, so the boundary below is drawn on purpose and
each side of it is tested.

**Flagged:**

* the `func` of a `Call`, as a bare name (`text(...)`) or an attribute
  (`sa.text(...)`). A call is unambiguous, so this fires even where the name
  is locally bound — calling a parameter you named `print` is not something to
  protect.
* any `import` that binds the name: `import text`, `from x import text`, and
  `from x import text as y`, which is reported on the alias's own line. This
  is the one that the adjacency scan could not see and the one that matters
  most, because the alias makes every later use invisible.
* any other *reference* that reads the name — `_emit = print`,
  `savepoint = session.begin_nested`, passing it as an argument, returning it.
  A reference is what a rename is made of.
* an attribute read of the name outside a call (`session.begin_nested`), for
  every banned name except `text` — see below.

Three shapes are not about a banned *name* at all, because the thing they catch
arrives without one. Each was measured as a clean file before it was added.

* **a call with an argument, where the bare call is correct.** `begin(` only.
  `session.begin()` opens a transaction and `session.begin(nested=True)` opens a
  savepoint, so the rule cannot be keyed on the name. Any argument fires,
  positional or keyword — `Session.begin` takes exactly one and it is `nested`.
* **`.write`/`.writelines` on a `stdout`/`stderr` base.** The base is matched on
  its whole dotted spelling, so `sys.stdout.write`, `stdout.write` after
  `from sys import stdout`, and `sys.stdout.buffer.write` all fire whatever
  `sys` was imported as. Reported under `print`.
* **a name bound from an exempt attribute read and then called.** `q = sa.text`
  followed by `q("select 1")`. See the next bullet for why the read alone is
  not enough, and why the call is the signal that separates the two.

**Deliberately not flagged**, because each is a collision with a common word
rather than a use of the banned thing:

* `response.text` and any other plain attribute read spelled `.text`. This is
  the one name where an attribute that is not being called is far more likely
  to be an HTTP body than a SQLAlchemy construct, so `text` alone is exempt
  from the attribute-reference shape. The other four names are not English and
  are flagged as attributes.

  The residual hole this used to leave — `q = sa.text` then `q("select 1")` —
  is now closed on the one signal that tells the two apart: **the bound name
  gets called**. A `str` is not callable, so `body = response.text` never has a
  call on the other end, and the innocent shape stays silent. Binding it and
  *not* calling it — `q = sa.text; return q` — is still not caught, and is
  named below.
* bare `Response`, including `httpx.Response`. See rule 4b.
* a parameter or a local named `text`, and every read of it. A name the file
  *binds for itself* — a parameter, an assignment target, a `for`/`with`/
  `except` target, a `def`, a `class` — is the file's own word, and reading it
  back is not a reference to the banned name. An `import` binding does **not**
  count as the file's own: an import is precisely the banned thing arriving,
  which is why `Any` stays flagged at every one of its uses in a file that
  imports it.
* a keyword argument `text=`, which is a parameter name at the call site and
  not a value.
* an attribute *assignment* `obj.text = x`, and any other store or delete.
* `def text(...)` and `class Text`, which are definitions of something else
  that happens to share the word.

## What this gate does NOT catch, and will not

These holes are known, load-bearing, and left open on purpose. Writing them down
is worth more than a detector that half-closes them, because an enforcement
script is trusted exactly as far as its stated scope.

**1. An annotated assignment from an `Any`-typed expression.** This is a
fourth spelling of type erasure and the gate is blind to it:

    scope_state: dict[str, object] | None = request.scope.get("state")

That makes the identical unverified assertion as
`cast("dict[str, object]", request.scope.get("state"))` with the token
removed. pyright accepts it — assigning `Any` to a declared type is always
allowed — and so does this script, with no exemption recorded anywhere. It is
the spelling a developer reaches for the *moment this gate complains about
`cast(`*, which makes it the most likely thing to be sitting in the tree.

The countermeasure is review, plus preferring runtime-checked construction
over assertion: `[dict(entry) for entry in raw]` builds a value the runtime
has actually seen, where a declared annotation only claims one. **This script
does not enforce that and cannot.**

**2. Rule 6 counts lines, so `;` defeats it.** A 399-line file with three
statements on every line passes the length cap while being twice the thing the
cap exists to prevent. Ruff's formatter splits compound statements and is the
real control here; the line count is a backstop, not a proof.

**3. A name assembled at runtime.** `getattr(sa, "t" + "ext")` binds
SQLAlchemy's `text` under a name the AST never sees, and neither do
`globals()["text"]`, `importlib.import_module`, or `eval`. Banning `getattr`
was considered and rejected on measurement: `src/` holds six `getattr` calls
today, four with a constant attribute name (`"detail"`, `"resources"`) and two
with a module constant, and every one of them reads Starlette or FastAPI state
that is untyped by construction. A rule keyed on a *constant* attribute name
would therefore start life with six false positives — and would still miss the
evasion above, whose attribute name is a `BinOp`. A rule keyed on a
*non*-constant name would catch that one spelling and none of the others.

**4. A banned thing bound and never called in the same file.** The deferred-call
shape needs both halves — `q = sa.text` *and* `q(…)` — in one file, because the
call is the only thing that distinguishes it from `body = response.text`. So
`q = sa.text; return q`, a module-level `QUERY = sa.text` consumed by an
importer, and `self.q = sa.text` (an attribute target, not a `Name`) are all
missed. Scope is not modelled either, in keeping with the rest of the script: an
assignment in one function and a call of the same identifier in another count as
a pair. That errs toward the false positive in a shape nobody writes and toward
silence in the shape that matters, which is the wrong way round, and it is the
price of not re-flagging every `response.text` in the tree.

**5. A response object handed through rather than constructed.** Rule 4b sees
`JSONResponse(...)` by name. A domain function that takes a `Response` as a
parameter and returns it, or that returns something an `api/` module later
converts, decides nothing itself and is correctly silent — but so is a domain
function that receives a factory and calls it. And bare `Response` is not
banned at all, for the `httpx` reason given under rule 4b, so a domain module
that does `Response(status_code=418, content=b"")` passes. The concrete
subclasses were the measurable, unambiguous set; `Response` is where this rule
stops.

**6. Writes to a stream this script cannot spell.** The stdout rule matches a
dotted chain, so `open("/dev/stdout").write(v)`, `os.write(1, b"…")`, and a
handle passed in as a parameter (`def emit(out): out.write(v)`) are all missed.
The first two are the "assembled name" family above under another name. The
third is not detectable at all without types: the gate cannot know what `out`
is, and a rule that guessed would flag every legitimate `.write` in the tree.

**7. An `AsyncSession` obtained without naming a tenant — DECLINED 2026-08-06,
and recorded here so the analysis is not re-derived.** An `unscoped-session`
rule was proposed: `titlepipe_core.db.__all__` exports `make_sessionmaker`, and
calling the `async_sessionmaker` it returns yields a session with no
`after_begin` listener and therefore no tenant, which `tenant_session` is the
only thing that supplies.

The affordable form of that rule is "a `Call` on something named
`sessionmaker`", because this script keys on IDENTIFIERS and has no type
resolution — it cannot know what a name refers to, which is the same limit
already written down under holes 3 and 4. A parameter named `session_factory`,
`maker`, `sm`, or `self._sessions` walks straight through it, and every one of
those is a name a reasonable person writes. The rule would fire on the spelling
and not on the thing, and this file's own docstring argues at length that a rule
which fires on a common identifier is a rule that gets switched off — and, worse
here, a rule people learn to ROUTE AROUND by renaming a parameter, which is
indistinguishable from ordinary code and leaves no trace.

The path that actually mattered is closed elsewhere and by a check that cannot
be renamed past: `tenant_session` writes `TENANT_SCOPED_MARK` into
`Session.info` and `TenantRepository.__init__` raises `RuntimeError` on a
session that does not carry it. That is a runtime check on the object, not a
scan for a word, so a differently-named factory does not evade it.

**The residual this rule would have caught, and which nothing catches:** a raw
`session.execute(...)` / `session.scalars(...)` in `src/` OUTSIDE the `db`
package, bypassing repositories entirely. Such a call is still tenant-scoped if
the session came from `tenant_session` — the GUC is on the connection and the
policies do the work — so it is not a leak; it is a layering violation that
puts query construction where no `TenantRepository` reviewed it. It is left to
review, like holes 1 and 6.

The honest boundary is that this gate catches renames and idioms, not
adversaries. `from sqlalchemy import text as sql` is what a tired person writes
and `literal_column` is what a helpful person reaches for; both are now caught.
`"t" + "ext"` is what somebody writes to get past this file, and at that point
the control is review, not a detector.

## `rules-allow` — two forms, both rule-scoped, and exactly what each covers

**Line form.** `# rules-allow(<rule-id>): <reason>` on the *same physical line*
as a violating token exempts that line **for that one rule**. Use it for the
one-off.

**File form.** `# rules-allow-file(<rule-id>): <reason>` as a comment of its own
exempts that one named rule for the whole file. Rule 6 needs this — a file's
length is attached to no line — and so does the boundary module whose every
third line is the same justified exemption.

**Both forms have to be the comment, not a sentence about one.** This was a
substring test, and MEASURED against the gate the file below reported *no*
violations at all:

    # A `# rules-allow-file(print): reason goes here` comment turns rule 5 off.
    def f(name):
        print(name)

`FILE_ALLOW_PREFIX in text` matched the form quoted inside an English sentence,
the words after it were long enough to satisfy rule 7, and rule 5 was switched
off for the whole file by a line of documentation. In a repository whose
comments explain its own controls at this length, that is not a hypothetical.
(The bare `rules-allow-file(` with no closing parenthesis does *not* reproduce
it — that lands in the malformed-exemption branch and is reported. It takes a
closing parenthesis and a real rule id.)

The two forms are now anchored, and to **different** places, because what the
tree contains differs:

* the **line form** may open the comment or any `#`-delimited segment of it.
  `tokenize` emits one COMMENT token for everything after the first `#` on a
  line, and fifteen real exemptions in this tree are written
  `# pyright: ignore[…]  # rules-allow(any-type): …` — the suppression and the
  reason for it on the line they excuse. Requiring position 0 would reject all
  fifteen, so that anchor was measured and rejected.
* the **file form** must open the comment. Its blast radius is the whole file,
  the one real use of it is a comment of its own, and a stricter anchor there
  costs nothing.

A form found anywhere else is reported rather than obeyed — but only when it
*would have granted*: a real rule id, a closing parenthesis, and a reason long
enough for rule 7. A passing mention grants nothing under any reading and is
left alone, because a gate that made every sentence about itself an error is a
gate whose documentation gets deleted.

Docstrings were never affected. Only COMMENT tokens are read, which is why the
docstring you are reading can spell both forms out in full.

The residual hole is that prose which opens a `#` segment with a complete,
well-reasoned line-form exemption, on the exact line that violates, still grants
it. It has to be that line and that rule; the file-wide version of it is closed.

Because rule 6 is attached to no line, the *line* form can never grant it.
`# rules-allow(file-length): …` parsed cleanly, was recorded as an accepted
exemption, and was then never consulted: the file-length violation carries
`line=0` and is only ever checked against the file-form set. It failed closed —
the file still failed the length cap — which is the worse direction to be
silent in, because the author sees a rejected file and a reason they wrote that
apparently did nothing. It is now rejected by name, pointing at the form that
works.

Both are rule-scoped for the same reason. A file excused for `any-type` must
not thereby acquire a licence to `print(`, and neither must a *line*: the
earlier line form keyed on the line number alone, so

    n = cast("int", rows); print(name)  # rules-allow: rowcount is int here

laundered the `print` on the strength of a reason that justified only the
cast. A reason answers for one rule. Naming it is how it stays answerable.

A bare `# rules-allow: <reason>` with no rule id is therefore itself a
violation, not a whole-line pass.

Rule ids are the keys of `RULES` below. An unrecognised id is a violation, not
a no-op: a typo in an exemption is a rule that silently stopped running.

Both forms are subject to rule 7, and **an allow that fails rule 7 does not
grant its exemption**. Otherwise `# rules-allow(print): x` would suppress the
violation it sits on and report a rule-7 failure that a second `rules-allow`
could then suppress in turn.

## Scan roots, and why finding nothing is a failure

`services/*/src` and `libs/*/src`, resolved from the repository root — this
file's parent's parent, never `cwd`. The script is run as
`../../scripts/check_backend_rules.py` from a service directory, where a
cwd-relative root would match nothing.

Matching nothing **exits non-zero**. A gate that cannot find the code has not
checked it, and the three ways this happened were all silent: a mistyped root
path, a root argument pointing at a single service, and — the subtle one — a
checkout living under a directory named `venv` or `node_modules`, which made
every absolute path contain a skipped component and emptied the scan. Skipped
directory names are therefore matched against each file's path *relative to
its own scan root*, never against the absolute path, so where the repository
happens to be checked out cannot change what is scanned.

The scanned-file count is printed on every path for the same reason: a silent
success and a scan of nothing look identical from the outside.
"""

from __future__ import annotations

import ast
import io
import re
import sys
import tokenize
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Final

REPO_ROOT: Final = Path(__file__).resolve().parent.parent

SCAN_ROOT_GLOBS: Final = ("services/*/src", "libs/*/src")

# Every glob above is `<top>/<project>/src`, so a scanned file's repository-
# relative path is `<top>/<project>/src/<package>/<module path…>`. The path
# exemptions below are anchored with this, which is what makes them talk about
# path *components* at a known depth rather than substrings.
SCAN_ROOT_DEPTH: Final = 3

MAX_FILE_LINES: Final = 400
MIN_ALLOW_REASON_LENGTH: Final = 12

# Directory names that are never source: build products, caches and installed
# third-party trees. `tests` used to be in here and is deliberately gone. It was
# excused because rule 3 does not apply to test code — but this repository's
# tests are at `services/*/tests`, beside `src/` and outside the scan roots
# entirely, so the name never needed skipping to achieve that. What it did
# achieve was excusing a real package: `…/src/titlepipe_probe/tests/queries.py`
# scanned clean with a `text(…)` and a `print(…)` in it while the identical body
# one directory over was caught. Everything under a scan root is scanned; a
# `src/**/tests/` package that genuinely needs raw SQL can earn a
# `rules-allow-file`.
SKIPPED_DIRECTORY_NAMES: Final = frozenset(
    {".venv", "venv", "__pycache__", "node_modules", ".mypy_cache", ".ruff_cache"}
)

# Every rule id an exemption may name, with the message quoted back at whoever
# has to fix it. Keys are the vocabulary of both `rules-allow` forms.
RULES: Final[dict[str, str]] = {
    "any-type": "type erasure is a decision; make it a visible one",
    "savepoint": "a SAVEPOINT turns a statement RLS refused into a silent no-op",
    "raw-sql": "raw SQL leaves the ORM's tenant scoping behind",
    "http-exception": "only api/errors.py decides what a failure is over HTTP",
    "http-response": "only api/ decides what a result looks like over HTTP",
    "print": "stdout bypasses the redaction processor",
    "file-length": f"over {MAX_FILE_LINES} lines stops being reviewable",
}

# Rule ids the *line* form can never grant, because the violation they suppress
# is attached to no line. A `# rules-allow(file-length): …` used to parse, be
# recorded, and then never be consulted — the file-length violation carries
# `line=0` and is only ever tested against the file-form set.
FILE_ONLY_RULE_IDS: Final = frozenset({"file-length"})

ALLOW_MARKER: Final = "rules-allow"
FILE_ALLOW_PREFIX: Final = "rules-allow-file("
LINE_ALLOW_PREFIX: Final = "rules-allow("
# The old, rule-less line form. It is still recognised so that writing it earns
# an explanation instead of being swallowed by the "neither form" branch.
BARE_LINE_ALLOW_PREFIX: Final = "rules-allow:"

# Where in a comment each form has to *begin* for it to be an exemption rather
# than a sentence about one. See the `rules-allow` section of the module
# docstring; both anchors are measured against this tree, and the two differ
# because what the tree contains differs.
#
# The line form may open any `#`-delimited segment, because `tokenize` gives one
# COMMENT token for everything after the first `#` on a line and fifteen real
# exemptions in this tree are written as
# `# pyright: ignore[…]  # rules-allow(any-type): …`. Requiring position 0
# would reject all fifteen.
#
# The file form must open the comment, because its blast radius is the whole
# file and the one real use of it is a comment of its own.
_FILE_ALLOW_ANCHOR: Final = re.compile(r"^#+[ \t]*" + re.escape(FILE_ALLOW_PREFIX))
_LINE_ALLOW_ANCHOR: Final = re.compile(r"(?:^|[ \t])#+[ \t]*" + re.escape(LINE_ALLOW_PREFIX))
_BARE_ALLOW_ANCHOR: Final = re.compile(r"(?:^|[ \t])#+[ \t]*" + re.escape(BARE_LINE_ALLOW_PREFIX))
_MARKER_ANCHOR: Final = re.compile(r"(?:^|[ \t])#+[ \t]*" + re.escape(ALLOW_MARKER))


@dataclass(frozen=True)
class NameRule:
    """A banned name, and whether reading it as an attribute counts as using it.

    `attribute_is_reference` is False only for names that are ordinary data
    attributes on unrelated objects. `response.text` is an HTTP body; there is
    no object in this world with a `.begin_nested` that is not a SQLAlchemy
    session. A call is always a use, whichever way it is spelled, so this flag
    changes nothing about `sa.text(...)`.
    """

    rule_id: str
    names: frozenset[str]
    attribute_is_reference: bool
    message: str


NAME_RULES: Final = (
    NameRule("any-type", frozenset({"Any"}), True, "`Any` erases the type"),
    NameRule("any-type", frozenset({"cast"}), True, "`cast(` asserts what was not proven"),
    NameRule(
        "savepoint",
        frozenset({"begin_nested"}),
        True,
        "`begin_nested(` opens a SAVEPOINT, and a SAVEPOINT is how a statement RLS refused "
        "stops being an error",
    ),
    NameRule(
        "raw-sql",
        # `literal_column` splices a string into the statement exactly as `text`
        # does; `raw_connection` returns the DBAPI connection, which leaves the
        # ORM's filters *and* the Session events that set the tenant GUC behind.
        # Neither is an English word, so both take the attribute shape too.
        #
        # `TextClause` and `ColumnClause` are the classes those factories build:
        # `text(x)` *is* `TextClause(x)` and `literal_column(x)` *is*
        # `ColumnClause(x, is_literal=True)`. Banning a factory and not its
        # product bans a spelling rather than a thing, and constructing the
        # class directly scored a clean file against this gate. Neither class
        # name collides with an English word, so both take every shape.
        frozenset(
            {
                "exec_driver_sql",
                "literal_column",
                "raw_connection",
                "TextClause",
                "ColumnClause",
            }
        ),
        True,
        "raw SQL is not tenant-scoped by the ORM; keep it in a db/ package",
    ),
    NameRule(
        "raw-sql",
        # `text` is the exception to the attribute shape: `.text` is an HTTP
        # response body far more often than it is a SQLAlchemy construct.
        frozenset({"text"}),
        False,
        "raw SQL is not tenant-scoped by the ORM; keep it in a db/ package",
    ),
    NameRule(
        "http-exception",
        frozenset({"HTTPException"}),
        True,
        "raise a DomainError; api/errors.py owns the HTTP mapping",
    ),
    NameRule(
        "http-response",
        # The concrete response classes, and deliberately **not** bare
        # `Response`: `httpx.Response` is what an engine adapter annotates, and
        # `starlette.responses.Response` is a legitimate middleware annotation —
        # `api/request_context.py` has two of them today. None of the concrete
        # names below exists in `httpx`, so each one is unambiguously a decision
        # about what this service returns over HTTP.
        frozenset(
            {
                "JSONResponse",
                "ORJSONResponse",
                "UJSONResponse",
                "HTMLResponse",
                "PlainTextResponse",
                "RedirectResponse",
                "StreamingResponse",
                "FileResponse",
            }
        ),
        True,
        "return a domain value; api/ owns what it becomes over HTTP",
    ),
    NameRule("print", frozenset({"print"}), True, "`print(` bypasses redaction"),
)

# Names that are only banned when they are *called with an argument*, because
# the bare call is correct and the argument is the whole hazard.
#
# `Session.begin` is the only one. MEASURED against SQLAlchemy 2.0.51:
# `inspect.signature(Session.begin)` is `(self, nested: bool = False)`, and
# `session.begin(nested=True)` emits `SAVEPOINT sa_savepoint_1` — byte for byte
# what `begin_nested()` emits. So `begin(` with any argument at all is a
# savepoint: the keyword spelling, and the positional `begin(True)` that the
# signature also accepts. `session.begin()`, `engine.begin()` and
# `connection.begin()` take no argument and are untouched.
#
# `begin(nested=False)` is caught too. It is not a savepoint, but it is a
# savepoint one character away, and the rule that had to distinguish them would
# be a rule about the value of a literal.
CALL_ARGUMENT_RULES: Final[dict[str, tuple[str, str]]] = {
    "begin": (
        "savepoint",
        "`begin(nested=…)` opens the same SAVEPOINT as `begin_nested(`; "
        "the no-argument `begin()` is the one that is fine",
    ),
}

# Rule 5 is about the channel, not about the word `print`. These two names are
# the channel. `sys.stdout.write(v)` scored a clean file against a gate that
# banned only `print`, and it is the same unredacted path to a log aggregator.
#
# The base is matched on its whole dotted spelling, so `sys.stdout.write`,
# `stdout.write` after `from sys import stdout`, and `sys.stdout.buffer.write`
# all match, whatever `sys` was imported as. `subprocess`-style `proc.stdin` and
# a plain `f.write(…)` to a real file do not.
STREAM_NAMES: Final = frozenset({"stdout", "stderr"})
STREAM_WRITE_METHODS: Final = frozenset({"write", "writelines"})
STREAM_WRITE_MESSAGE: Final = (
    "writing to sys.stdout/sys.stderr bypasses redaction exactly as `print(` does"
)

# The banned names whose *attribute* shape is deliberately not a reference —
# today only `text`, because `response.text` is an HTTP body. Reading one and
# binding it to a name that is then called is the residual hole that leaves, and
# it is closed separately: see `_deferred_call_violations`.
EXEMPT_ATTRIBUTE_NAMES: Final = frozenset(
    name for rule in NAME_RULES if not rule.attribute_is_reference for name in rule.names
)

# The suppressions that are comments rather than code. Each turns a type
# checker off; none of them is visible to the AST, which is why they are
# matched against comment text. `pyright: strict` is deliberately absent —
# it tightens, and this rule is about loosening without a record.
_TYPE_IGNORE = re.compile(r"type:\s*ignore")
_PYRIGHT_IGNORE = re.compile(r"pyright:\s*ignore")
_PYRIGHT_MODE_DOWNGRADE = re.compile(r"pyright:\s*(?:basic|standard)\b")
_PYRIGHT_RULE_OFF = re.compile(r"pyright:\s*report[A-Za-z]\w*\s*=\s*false\b", re.IGNORECASE)
# A PEP-484 type comment: the signature form, `# type: (int, str) -> bool`.
# The `ignore` form is matched above and must not be caught here as well.
_TYPE_COMMENT_SIGNATURE = re.compile(r"type:\s*\(.*\)\s*->")
_BARE_ANY = re.compile(r"\bAny\b")


@dataclass(frozen=True)
class Violation:
    """One thing to fix. `line` is 0 for a rule that is about the whole file."""

    path: str
    line: int
    rule_id: str
    message: str


def _module_path(relative: str) -> tuple[str, ...]:
    """The path components below the distribution package, or `()` if unexpected.

    `services/core-api/src/titlepipe_core/api/errors.py` → `("api", "errors.py")`.
    Returning `()` for anything shorter means an unrecognised layout gets no
    exemption, which is the safe direction to fail in.
    """
    parts = Path(relative).parts
    if len(parts) <= SCAN_ROOT_DEPTH + 1:
        return ()
    return parts[SCAN_ROOT_DEPTH + 1 :]


def _path_exemption(rule_id: str, relative: str) -> bool:
    """The scope carve-outs that are part of the rules themselves.

    Both are narrow and both name the one place the banned thing is correct.
    Neither is a `rules-allow` — an exemption the rule was written with is not
    the same object as one somebody added afterwards.

    Both are anchored to path *components at a known depth*, because both were
    substring tests and both were wrong for it. `relative.endswith(
    "api/errors.py")` exempted `notapi/errors.py`, and `"/db/" in relative`
    handed the raw-SQL carve-out to a `db` directory at any depth — including
    `api/db/`, where route handlers live and where raw SQL is exactly the thing
    the rule exists to stop.
    """
    module = _module_path(relative)
    if rule_id == "raw-sql":
        return module[:1] == ("db",)
    if rule_id == "http-exception":
        return module == ("api", "errors.py")
    if rule_id == "http-response":
        # Wider than `http-exception`'s carve-out on purpose, and this is why it
        # is a separate rule id rather than the same one. `api/errors.py` is the
        # only place that decides what a *failure* becomes, but a router
        # returning a `FileResponse` for a rendered report is not a failure and
        # is ordinary FastAPI. The whole `api` package is the HTTP layer; nothing
        # below it is.
        return module[:1] == ("api",)
    return False


@dataclass
class Allows:
    """The exemptions a file claims, after rule 7 has had its say.

    `lines` is keyed by `(rule_id, line)` and not by line alone. One reason
    answers for one rule; co-location on a physical line is not an argument.
    """

    lines: set[tuple[str, int]]
    files: set[str]


def _read_allows(
    comments: list[tokenize.TokenInfo], relative: str
) -> tuple[Allows, list[Violation]]:
    """Collect the file's exemptions and the rule-7 failures among them.

    A malformed or under-reasoned allow is returned as a violation and is *not*
    added to `Allows`. That ordering is the whole point of rule 7: an exemption
    nobody justified must not suppress anything, least of all itself.
    """
    allows = Allows(lines=set(), files=set())
    problems: list[Violation] = []

    for token in comments:
        text = token.string
        if ALLOW_MARKER not in text:
            continue
        line = token.start[0]

        # An exemption has to *be* the comment, or be one of the comment's
        # `#`-delimited segments. A sentence that merely quotes the form is
        # prose, and until this anchor existed it was an exemption:
        #
        #     # A `# rules-allow-file(print): reason goes here` comment …
        #
        # was a well-formed file-form exemption sitting inside an English
        # sentence, and MEASURED against the gate it silenced every `print(` in
        # the file it appeared in, reporting nothing at all.
        if (anchored := _MARKER_ANCHOR.search(text)) is None:
            problem = _unanchored_marker(text, relative, line)
            if problem is not None:
                problems.append(problem)
            continue

        # The file form is tested first because its prefix contains the marker
        # but not the line form's prefix: `rules-allow-file(` is not
        # `rules-allow(`, so the two cannot be confused in either order.
        if _FILE_ALLOW_ANCHOR.match(text):
            problem = _read_scoped_allow(
                text.split(FILE_ALLOW_PREFIX, 1)[1], relative, line, FILE_ALLOW_PREFIX, allows.files
            )
            if problem is not None:
                problems.append(problem)
            continue

        if (found := _LINE_ALLOW_ANCHOR.search(text)) is not None:
            accepted: set[str] = set()
            problem = _read_scoped_allow(
                text[found.end() :], relative, line, LINE_ALLOW_PREFIX, accepted
            )
            if problem is not None:
                problems.append(problem)
            allows.lines.update((rule_id, line) for rule_id in accepted)
            continue

        # The file form's prefix is present but not at the start of the comment.
        # It is refused rather than downgraded to the line form, because the two
        # cover different amounts and guessing which was meant is how a reason
        # answers for more than it was written about.
        if FILE_ALLOW_PREFIX in text[anchored.start() :]:
            problems.append(
                Violation(
                    relative,
                    line,
                    ALLOW_MARKER,
                    f"'{FILE_ALLOW_PREFIX}' must start the comment to exempt the file; "
                    f"write it as a comment of its own",
                )
            )
            continue

        if _BARE_ALLOW_ANCHOR.search(text):
            # The form that used to exempt the whole line. It is rejected rather
            # than reinterpreted: guessing which rule the author meant is how a
            # reason ends up answering for a violation nobody read.
            problems.append(
                Violation(
                    relative,
                    line,
                    ALLOW_MARKER,
                    f"'# {BARE_LINE_ALLOW_PREFIX} …' does not name a rule, so it exempts nothing; "
                    f"write '# {LINE_ALLOW_PREFIX}<rule-id>): <reason>' with one of "
                    f"{', '.join(sorted(RULES))}",
                )
            )
            continue

        problems.append(
            Violation(
                relative,
                line,
                ALLOW_MARKER,
                f"{ALLOW_MARKER!r} in neither form; use "
                f"'# {LINE_ALLOW_PREFIX}<rule-id>): <reason>' or "
                f"'# {FILE_ALLOW_PREFIX}<rule-id>): <reason>'",
            )
        )

    return allows, problems


def _unanchored_marker(text: str, relative: str, line: int) -> Violation | None:
    """Report a complete exemption buried in prose; ignore a mere mention.

    The distinction is what the text *would have done*. `# never write
    rules-allow-file( in a comment` names no rule and grants nothing under any
    reading, so it is prose and is passed over — a gate that made every sentence
    about itself an error is a gate whose documentation gets deleted.

    A well-formed one is different, and is the reason this function exists: it
    names a real rule, carries a reason long enough for rule 7, and MEASURED
    against this gate before the anchor it silenced the rule for the whole file
    while reporting nothing. It now says so, rather than going quiet, because a
    reader of that sentence cannot otherwise tell which of the two it is.
    """
    for prefix in (FILE_ALLOW_PREFIX, LINE_ALLOW_PREFIX):
        found = text.find(prefix)
        if found == -1:
            continue
        rule_id, closed, remainder = text[found + len(prefix) :].partition("):")
        if closed and rule_id.strip() in RULES and _reason_is_adequate(remainder):
            return Violation(
                relative,
                line,
                ALLOW_MARKER,
                f"a complete '{prefix}{rule_id.strip()}): …' sits inside this comment rather "
                "than starting it or one of its '#' segments, so it grants nothing; put it in "
                "a comment of its own if it was meant, and reword it if it was prose",
            )
    return None


def _read_scoped_allow(
    body: str, relative: str, line: int, prefix: str, accepted: set[str]
) -> Violation | None:
    """Parse `<rule-id>): <reason>` and record the id, or say what is wrong with it.

    Both `rules-allow` forms have the same grammar after their prefix, so they
    have the same parser. A form that cannot drift away from the other is one
    fewer place for the two to disagree about what a reason has to cover.
    """
    rule_id, closed, remainder = body.partition("):")
    rule_id = rule_id.strip()
    if not closed:
        return Violation(
            relative,
            line,
            ALLOW_MARKER,
            f"malformed exemption; expected {prefix}<rule-id>): <reason>",
        )
    if rule_id not in RULES:
        return Violation(
            relative,
            line,
            ALLOW_MARKER,
            f"unknown rule id {rule_id!r}; expected one of {', '.join(sorted(RULES))}",
        )
    if prefix == LINE_ALLOW_PREFIX and rule_id in FILE_ONLY_RULE_IDS:
        # Accepting this and then never consulting it is how a reason becomes
        # decoration. See the `rules-allow` section of the module docstring.
        return Violation(
            relative,
            line,
            ALLOW_MARKER,
            f"{rule_id!r} is about the whole file, so a line exemption can never grant it; "
            f"write '# {FILE_ALLOW_PREFIX}{rule_id}): <reason>'",
        )
    if not _reason_is_adequate(remainder):
        return _short_reason(relative, line, remainder)
    accepted.add(rule_id)
    return None


def _reason_is_adequate(remainder: str) -> bool:
    return len(remainder.strip()) >= MIN_ALLOW_REASON_LENGTH


def _short_reason(relative: str, line: int, remainder: str) -> Violation:
    return Violation(
        relative,
        line,
        ALLOW_MARKER,
        f"reason {remainder.strip()!r} is under {MIN_ALLOW_REASON_LENGTH} characters; "
        "say what makes this correct, not that it is",
    )


def _comment_suppressions(text: str) -> list[str]:
    """The "stop checking this" messages a single comment's text earns.

    All of these are one rule — `any-type` — because they are one decision. The
    checker differs, and so does the syntax, but each says "take my word for
    it" in the place where nothing else in this script can see it.
    """
    found: list[str] = []
    if _TYPE_IGNORE.search(text):
        found.append("`# type: ignore` silences the checker without a record of why")
    if _PYRIGHT_IGNORE.search(text):
        found.append("`# pyright: ignore` silences the checker without a record of why")
    if _PYRIGHT_MODE_DOWNGRADE.search(text):
        found.append(
            "a `# pyright: basic`/`standard` comment drops this file out of strict mode entirely"
        )
    if _PYRIGHT_RULE_OFF.search(text):
        found.append("a `# pyright: report…=false` comment turns a rule off for the whole file")
    if _TYPE_COMMENT_SIGNATURE.search(text) and _BARE_ANY.search(text):
        # A PEP-484 type comment is an annotation that happens to be written as
        # a comment, so `Any` in one erases exactly as much as `Any` in an
        # annotation — and the AST pass cannot see a character of it.
        found.append("`Any` in a PEP-484 type comment erases the type where the AST cannot see it")
    return found


def _names_the_file_binds(tree: ast.Module) -> frozenset[str]:
    """Names this file defines for itself, which are therefore its own words.

    A parameter called `text`, a local called `cast`, a `def print` — reading
    any of those back is not a reference to the banned name, and flagging it is
    how a gate gets switched off. Imports are excluded on purpose: an import is
    the banned thing arriving in the file, not the file coining a meaning, and
    excluding them is what keeps `Any` flagged at every use in a module that
    does `from typing import Any`.

    Scope is not modelled. A name bound anywhere in the file is treated as
    bound everywhere in it, which errs toward silence in the one direction —
    common identifiers — where a false positive costs the most.
    """
    bound: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Name):
            if not isinstance(node.ctx, ast.Load):
                bound.add(node.id)
        elif isinstance(node, ast.arg):
            bound.add(node.arg)
        elif isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef):
            bound.add(node.name)
        elif isinstance(node, ast.Global | ast.Nonlocal):
            bound.update(node.names)
        # The four below carry their bound name as a plain string rather than
        # as a `Name` node, so walking for `Name` in a store context misses
        # them: `except ValueError as text` binds `text` just as firmly as
        # `text = ...` does.
        elif isinstance(node, ast.ExceptHandler | ast.MatchAs | ast.MatchStar) and (
            node.name is not None
        ):
            bound.add(node.name)
        elif isinstance(node, ast.MatchMapping) and node.rest is not None:
            bound.add(node.rest)
    return frozenset(bound)


def _imported_names(alias: ast.alias) -> tuple[str, ...]:
    """Every banned-name candidate an `import` alias could be binding.

    `from x import text` binds `text`; `from x import text as sql` binds `sql`
    but has still pulled `text` into the file, and that second one is the whole
    reason this pass exists. `import a.b.text` is checked on its last component
    for the same reason.

    Deduplicated, because the three candidates coincide in the ordinary case —
    `from typing import Any` would otherwise report the same alias twice.
    """
    candidates = [alias.name, alias.name.rpartition(".")[2]]
    if alias.asname is not None:
        candidates.append(alias.asname)
    return tuple(dict.fromkeys(candidates))


def _dotted_spelling(node: ast.expr) -> tuple[str, ...]:
    """The components of a `a.b.c` chain, or `()` for anything else.

    `sys.stdout.buffer` → `("sys", "stdout", "buffer")`. A chain rooted in
    anything but a plain `Name` — a call, a subscript — returns `()`, which is
    the safe direction: no components, so no rule keyed on a component fires.
    """
    parts: list[str] = []
    while isinstance(node, ast.Attribute):
        parts.append(node.attr)
        node = node.value
    if not isinstance(node, ast.Name):
        return ()
    parts.append(node.id)
    return tuple(reversed(parts))


def _called_bare_names(tree: ast.Module) -> frozenset[str]:
    """Every plain name that is called as a function somewhere in this file."""
    return frozenset(
        node.func.id
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
    )


def _deferred_call_violations(tree: ast.Module, report: Callable[[str, int, str], None]) -> None:
    """`q = sa.text` followed by `q("select 1")`.

    `text` is the one banned name whose attribute shape is not a reference,
    because `response.text` is an HTTP body — and the residual hole that leaves
    was named in this docstring and scored a clean file. This closes it on the
    one signal that separates the two: **the result gets called**. A string is
    not callable, so `body = response.text` followed by `body(…)` is not code
    anybody has; `q = sa.text` followed by `q(…)` is raw SQL with an extra line.

    Scope is not modelled, in keeping with `_names_the_file_binds`: the call and
    the assignment need only both be somewhere in the file.
    """
    called = _called_bare_names(tree)
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            targets: list[ast.expr] = list(node.targets)
        elif isinstance(node, ast.AnnAssign | ast.NamedExpr):
            targets = [node.target]
        else:
            continue
        value = node.value
        if not (isinstance(value, ast.Attribute) and value.attr in EXEMPT_ATTRIBUTE_NAMES):
            continue
        if any(isinstance(target, ast.Name) and target.id in called for target in targets):
            report(value.attr, value.lineno, "bound here and called as a function below")


def _name_violations(tree: ast.Module, relative: str) -> list[Violation]:
    """Every banned name the parsed file actually uses, with the shape it used.

    The classification is one node, one verdict: a node that is a call's `func`
    is judged as a call and never again as a reference, so `sa.text("x")` is
    one violation rather than two.
    """
    call_funcs = {id(node.func) for node in ast.walk(tree) if isinstance(node, ast.Call)}
    bound = _names_the_file_binds(tree)
    found: list[Violation] = []

    def report(name: str, line: int, shape: str) -> None:
        for rule in NAME_RULES:
            if name in rule.names and not _path_exemption(rule.rule_id, relative):
                found.append(Violation(relative, line, rule.rule_id, f"{rule.message} ({shape})"))

    def report_shape(rule_id: str, line: int, message: str) -> None:
        if not _path_exemption(rule_id, relative):
            found.append(Violation(relative, line, rule_id, message))

    def is_banned_as_attribute(name: str) -> bool:
        return any(name in rule.names and rule.attribute_is_reference for rule in NAME_RULES)

    def called_name(node: ast.Call) -> str | None:
        if isinstance(node.func, ast.Name):
            return node.func.id
        if isinstance(node.func, ast.Attribute):
            return node.func.attr
        return None

    for node in ast.walk(tree):
        if isinstance(node, ast.Import | ast.ImportFrom):
            for alias in node.names:
                for candidate in _imported_names(alias):
                    report(candidate, alias.lineno, "imported here")
            continue

        if isinstance(node, ast.Call):
            # A name that is fine to call and not fine to call *with an
            # argument*. `begin()` is a transaction; `begin(nested=True)` is a
            # savepoint, and the name rules cannot see the difference because
            # the difference is not in the name.
            shape_rule = CALL_ARGUMENT_RULES.get(called_name(node) or "")
            if shape_rule is not None and (node.args or node.keywords):
                report_shape(shape_rule[0], node.lineno, f"{shape_rule[1]} (called here)")
            # Not `continue`: the call's own `func` is walked separately below,
            # and that is where the banned-name rules see it.

        if isinstance(node, ast.Name):
            if id(node) in call_funcs:
                report(node.id, node.lineno, "called here")
            elif isinstance(node.ctx, ast.Load) and node.id not in bound:
                report(node.id, node.lineno, "referenced here")
            continue

        if isinstance(node, ast.Attribute):
            shape = "called here" if id(node) in call_funcs else "referenced here"
            if node.attr in STREAM_WRITE_METHODS and STREAM_NAMES & set(
                _dotted_spelling(node.value)
            ):
                report_shape("print", node.lineno, f"{STREAM_WRITE_MESSAGE} ({shape})")
            if id(node) in call_funcs:
                report(node.attr, node.lineno, "called here")
            elif isinstance(node.ctx, ast.Load) and is_banned_as_attribute(node.attr):
                report(node.attr, node.lineno, "referenced here")

    _deferred_call_violations(tree, report)
    return found


def scan_source(source: str, relative: str) -> list[Violation]:
    """Every violation in one file's text, exemptions already applied."""
    line_count = len(source.splitlines())

    # `tokenize` tolerates a leading BOM and `ast.parse` does not — it reports
    # it as an invalid non-printable character and the whole file becomes a
    # parse violation. Files in this tree have carried one before, so it is
    # stripped rather than reported. Nothing else on line 1 moves.
    source = source.removeprefix("\ufeff")

    try:
        tokens = list(tokenize.generate_tokens(io.StringIO(source).readline))
        tree = ast.parse(source)
    except (SyntaxError, ValueError, tokenize.TokenError) as exc:
        # Unparseable source is reported rather than skipped. A file the scanner
        # cannot read is a file none of these rules ran against.
        return [Violation(relative, 0, "parse", f"could not be parsed: {exc}")]

    comments = [token for token in tokens if token.type == tokenize.COMMENT]
    allows, violations = _read_allows(comments, relative)

    def suppressed(rule_id: str, line: int) -> bool:
        return rule_id in allows.files or (rule_id, line) in allows.lines

    if line_count > MAX_FILE_LINES and "file-length" not in allows.files:
        violations.append(
            Violation(
                relative,
                0,
                "file-length",
                f"{line_count} lines, over the {MAX_FILE_LINES}-line cap",
            )
        )

    for token in comments:
        line = token.start[0]
        if suppressed("any-type", line):
            continue
        violations.extend(
            Violation(relative, line, "any-type", message)
            for message in _comment_suppressions(token.string)
        )

    violations.extend(
        violation
        for violation in _name_violations(tree, relative)
        if not suppressed(violation.rule_id, violation.line)
    )

    return sorted(violations, key=lambda violation: (violation.line, violation.rule_id))


def scan_roots(root: Path) -> list[Path]:
    """The `services/*/src` and `libs/*/src` directories that actually exist."""
    found: list[Path] = []
    for pattern in SCAN_ROOT_GLOBS:
        found.extend(path for path in sorted(root.glob(pattern)) if path.is_dir())
    return found


def scannable_files(roots: list[Path]) -> list[Path]:
    """Every `.py` file under the given scan roots, in a stable order.

    Skipped directory names are matched against each file's path *relative to
    its own scan root*. Matching them against the absolute path made the scan
    depend on where the repository was checked out: a clone living anywhere
    under a directory called `venv` or `tests` — a scratch worktree, a CI
    cache, a reviewer's `~/venv/` — scanned zero files and reported clean.
    """
    found: list[Path] = []
    for source_root in roots:
        found.extend(
            path
            for path in sorted(source_root.rglob("*.py"))
            if not SKIPPED_DIRECTORY_NAMES & set(path.relative_to(source_root).parts[:-1])
        )
    return found


def scan_file(path: Path, relative: str) -> list[Violation]:
    """Read and scan one file, reporting a file this scanner cannot read at all.

    A `# -*- coding: latin-1 -*-` module with one high byte in it used to take
    the entire run down with an uncaught `UnicodeDecodeError`, so *no* file got
    a report. That is the same situation as unparseable source and gets the
    same answer: name the file, keep going.

    The handler caught only that one exception, which meant it still had the
    failure mode it was written to remove. MEASURED against this tree: a broken
    symlink under a scan root raises `FileNotFoundError` and a directory named
    `weird.py` raises `IsADirectoryError`, both uncaught, both aborting the run
    with a traceback before any file was reported. Neither is exotic — a stale
    editable-install link and a half-restored CI cache produce them — and in
    pre-commit the gate then failed with an errno instead of a filename.
    `OSError` covers both, plus the permission and I/O cases nobody has hit yet.

    `UnicodeDecodeError` is a `ValueError`, not an `OSError`, so it has to stay
    named. Its own `str` already says which byte at which offset, so one message
    serves both without losing anything.
    """
    try:
        source = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError) as exc:
        return [Violation(relative, 0, "parse", f"could not be read, so no rule ran on it: {exc}")]
    return scan_source(source, relative)


def main(argv: list[str]) -> int:
    """`argv[0]`, if given, replaces the repository root. Tests pass a tmp dir."""
    root = Path(argv[0]).resolve() if argv else REPO_ROOT
    roots = scan_roots(root)
    files = scannable_files(roots)

    # The count goes out on every path. Success with a count of 0 was the
    # failure mode this script actually had — a wrong root resolved to nothing
    # and reported clean — so a count of 0 is now a failure in its own right.
    summary = f"Scanned {len(files)} files under {root}."
    nothing_found = (
        "\nA gate that cannot find the code has not checked it. This is a failure, not a pass."
    )

    if not roots:
        print(f"Backend rules: no source tree. {summary}")
        print(f"  None of {', '.join(SCAN_ROOT_GLOBS)} matched a directory under that root.")
        print(nothing_found)
        return 1

    if not files:
        print(f"Backend rules: nothing to scan. {summary}")
        print(f"  {len(roots)} scan root(s) matched but hold no unskipped .py file.")
        print(nothing_found)
        return 1

    violations: list[Violation] = []
    for path in files:
        relative = path.relative_to(root).as_posix()
        violations.extend(scan_file(path, relative))

    if not violations:
        print(f"Backend rules: clean. {summary}")
        return 0

    print("Backend rule violations:\n")
    for violation in violations:
        where = f"{violation.path}:{violation.line}" if violation.line else violation.path
        print(f"  {where}\n      [{violation.rule_id}] {violation.message}")
    print(f"\n{summary}")
    print(
        "\nFix it, or record why the rule is wrong here:\n"
        f"  # {LINE_ALLOW_PREFIX}<rule-id>): <reason>   exempts that rule on that one line\n"
        f"  # {FILE_ALLOW_PREFIX}<rule-id>): <reason>   exempts that rule in this file\n"
        f"A reason under {MIN_ALLOW_REASON_LENGTH} characters is itself a violation."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
