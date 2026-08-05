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

**2. `begin_nested(`** — scope `src/`. A SAVEPOINT unwinds the tenant GUC. Roll
one back and `app.current_tenant` reverts to whatever it was before the
savepoint opened, so the next statement in the same transaction runs under the
wrong tenant — or none — and RLS enforces the wrong thing. There is no safe
nested transaction while the tenant lives in a session setting.

**3. `text` / `exec_driver_sql`** — scope `src/` **except** the `db` package
directly inside a distribution package. Raw SQL is how a query stops being
tenant-scoped, because the ORM's filters are what carry the scope. The `db`
packages own the handful of statements (`SET LOCAL`, health checks,
migrations) that must be raw, and they are reviewed as such. `tests/` is not
scanned at all: proving RLS denies a row requires raw SQL that deliberately
tries to reach across a tenant.

**4. `HTTPException`** — scope `src/` except each package's own `api/errors.py`.
One layer decides what a failure becomes over HTTP. Domain code that raises
`HTTPException` is domain code that cannot be called from a worker.

**5. `print`** — scope `src/`. Redaction lives in the structlog chain. A
`print` is an unredacted channel straight to stdout, and it is the shortest
path from a debugging session to NPI in a log aggregator.

**6. file > 400 lines** — scope `src/`. A cap, not a target. Reviewability is
the control this whole repository leans on.

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

**Deliberately not flagged**, because each is a collision with a common word
rather than a use of the banned thing:

* `response.text` and any other plain attribute read spelled `.text`. This is
  the one name where an attribute that is not being called is far more likely
  to be an HTTP body than a SQLAlchemy construct, so `text` alone is exempt
  from the attribute-reference shape. The residual hole is real and named:
  `q = sa.text` followed by `q("select 1")` is not caught. The other four
  names are not English and are flagged as attributes.
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

Two holes are known, load-bearing, and left open on purpose. Writing them down
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

## `rules-allow` — two forms, both rule-scoped, and exactly what each covers

**Line form.** `# rules-allow(<rule-id>): <reason>` on the *same physical line*
as a violating token exempts that line **for that one rule**. Use it for the
one-off.

**File form.** `# rules-allow-file(<rule-id>): <reason>` in any comment in the
file exempts that one named rule for the whole file. Rule 6 needs this — a
file's length is attached to no line — and so does the boundary module whose
every third line is the same justified exemption.

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
checkout living under a directory named `venv` or `tests`, which made every
absolute path contain a skipped component and emptied the scan. Skipped
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

# Directory names that are never source and never ours to police. `tests` is in
# here on purpose and is not an oversight — see rule 3.
SKIPPED_DIRECTORY_NAMES: Final = frozenset(
    {"tests", ".venv", "venv", "__pycache__", "node_modules", ".mypy_cache", ".ruff_cache"}
)

# Every rule id an exemption may name, with the message quoted back at whoever
# has to fix it. Keys are the vocabulary of both `rules-allow` forms.
RULES: Final[dict[str, str]] = {
    "any-type": "type erasure is a decision; make it a visible one",
    "savepoint": "a SAVEPOINT rollback unwinds the tenant GUC",
    "raw-sql": "raw SQL leaves the ORM's tenant scoping behind",
    "http-exception": "only api/errors.py decides what a failure is over HTTP",
    "print": "stdout bypasses the redaction processor",
    "file-length": f"over {MAX_FILE_LINES} lines stops being reviewable",
}

ALLOW_MARKER: Final = "rules-allow"
FILE_ALLOW_PREFIX: Final = "rules-allow-file("
LINE_ALLOW_PREFIX: Final = "rules-allow("
# The old, rule-less line form. It is still recognised so that writing it earns
# an explanation instead of being swallowed by the "neither form" branch.
BARE_LINE_ALLOW_PREFIX: Final = "rules-allow:"


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
        "`begin_nested(` opens a SAVEPOINT, whose rollback unwinds the tenant GUC",
    ),
    NameRule(
        "raw-sql",
        frozenset({"exec_driver_sql"}),
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
    NameRule("print", frozenset({"print"}), True, "`print(` bypasses redaction"),
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

        # The file form is tested first because its prefix contains the marker
        # but not the line form's prefix: `rules-allow-file(` is not
        # `rules-allow(`, so the two cannot be confused in either order.
        if FILE_ALLOW_PREFIX in text:
            problem = _read_scoped_allow(
                text.split(FILE_ALLOW_PREFIX, 1)[1], relative, line, FILE_ALLOW_PREFIX, allows.files
            )
            if problem is not None:
                problems.append(problem)
            continue

        if LINE_ALLOW_PREFIX in text:
            accepted: set[str] = set()
            problem = _read_scoped_allow(
                text.split(LINE_ALLOW_PREFIX, 1)[1], relative, line, LINE_ALLOW_PREFIX, accepted
            )
            if problem is not None:
                problems.append(problem)
            allows.lines.update((rule_id, line) for rule_id in accepted)
            continue

        if BARE_LINE_ALLOW_PREFIX in text:
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

    def is_banned_as_attribute(name: str) -> bool:
        return any(name in rule.names and rule.attribute_is_reference for rule in NAME_RULES)

    for node in ast.walk(tree):
        if isinstance(node, ast.Import | ast.ImportFrom):
            for alias in node.names:
                for candidate in _imported_names(alias):
                    report(candidate, alias.lineno, "imported here")
            continue

        if isinstance(node, ast.Name):
            if id(node) in call_funcs:
                report(node.id, node.lineno, "called here")
            elif isinstance(node.ctx, ast.Load) and node.id not in bound:
                report(node.id, node.lineno, "referenced here")
            continue

        if isinstance(node, ast.Attribute):
            if id(node) in call_funcs:
                report(node.attr, node.lineno, "called here")
            elif isinstance(node.ctx, ast.Load) and is_banned_as_attribute(node.attr):
                report(node.attr, node.lineno, "referenced here")

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
    """Read and scan one file, reporting a file this scanner cannot decode.

    A `# -*- coding: latin-1 -*-` module with one high byte in it used to take
    the entire run down with an uncaught `UnicodeDecodeError`, so *no* file got
    a report. That is the same situation as unparseable source and gets the
    same answer: name the file, keep going.
    """
    try:
        source = path.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        return [Violation(relative, 0, "parse", f"is not valid UTF-8, so no rule ran on it: {exc}")]
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
