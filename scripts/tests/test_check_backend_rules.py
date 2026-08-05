"""The backend rules gate.

An enforcement script with no tests is a script that gets loosened by whoever
is blocked by it, and nobody finds out. Four failure modes are specifically
covered here because all four were live possibilities while it was being
written, and three of them were later found in it:

1. **Scanning nothing and reporting clean.** The script is run as
   `../../scripts/check_backend_rules.py` from a service directory. A
   cwd-relative root resolves to zero files, and until it was made a failure
   that was indistinguishable from a clean tree unless the count was asserted.
   Every clean-tree test here asserts a non-zero scanned count, and the
   found-nothing cases assert a non-zero exit.

2. **Matching substrings.** `scrub_text(` is not `text(` and `Anything` is not
   `Any`. The tree contains the first of those four times today.

3. **Matching adjacency instead of meaning.** `from sqlalchemy import text as
   sa_text` is the conventional SQLAlchemy import, and a rule that fires only
   on a NAME immediately followed by `(` never sees it. Every shape the gate
   claims to flag is tested here, and — because `text` is an English word and
   a false positive is what gets a gate switched off — so is every shape it
   claims *not* to flag.

4. **Exempting more than the reason covers.** A path exemption that is a
   substring test exempts `notapi/errors.py`; a line exemption keyed on the
   line number launders every other rule sharing that line.

Everything runs against a `tmp_path` tree rather than the repository, so a test
here cannot start passing because somebody fixed the real code, and cannot
start failing because somebody added a legitimate exemption to it. The single
exception is `test_the_default_root_is_the_repository_...`, which exists
precisely because every other test passes an explicit root and therefore never
exercises how `REPO_ROOT` is derived; it asserts only that the count is
non-zero, which no change to the backend can falsify.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from check_backend_rules import MAX_FILE_LINES, MIN_ALLOW_REASON_LENGTH, main

# Long enough to satisfy rule 7, and phrased the way a real one should be.
GOOD_REASON = "the ASGI scope is MutableMapping[str, Any] and this follows an isinstance"


def write(root: Path, relative: str, source: str) -> str:
    """Create a source file under `root`. Returns the path the report will use."""
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(source, encoding="utf-8")
    return relative


def run(root: Path, capsys: pytest.CaptureFixture[str]) -> tuple[int, str]:
    code = main([str(root)])
    return code, capsys.readouterr().out


def scanned_count(output: str) -> int:
    match = re.search(r"Scanned (\d+) files", output)
    assert match is not None, f"no scanned-file count in output:\n{output}"
    return int(match.group(1))


# --- each rule fires --------------------------------------------------------


@pytest.mark.parametrize(
    ("rule_id", "source"),
    [
        ("any-type", "from typing import Any\n\n\ndef f() -> Any:\n    return 1\n"),
        ("any-type", "def f(x: int) -> int:\n    return x  # type: ignore[return-value]\n"),
        ("any-type", 'from typing import cast\n\nv = cast("int", 1)\n'),
        ("savepoint", "def f(session: object) -> None:\n    session.begin_nested()\n"),
        ("raw-sql", 'import sqlalchemy as sa\n\nq = sa.text("select 1")\n'),
        ("raw-sql", 'def f(s: object) -> None:\n    s.exec_driver_sql("select 1")\n'),
        ("http-exception", "from fastapi import HTTPException\n"),
        ("print", 'def f() -> None:\n    print("hello")\n'),
        ("file-length", "".join(f"x{n} = {n}\n" for n in range(401))),
    ],
)
def test_a_rule_fires_and_names_the_file(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], rule_id: str, source: str
) -> None:
    relative = write(tmp_path, "services/svc/src/pkg/offender.py", source)
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert relative in output
    assert f"[{rule_id}]" in output


def test_a_short_allow_reason_is_itself_a_violation(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    relative = write(
        tmp_path,
        "libs/lib/src/pkg/terse.py",
        "def f() -> None:\n    pass  # rules-allow(print): because\n",
    )
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert relative in output
    assert "[rules-allow]" in output


def test_libs_are_scanned_as_well_as_services(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """Both root globs, not just the first one anybody tested."""
    relative = write(tmp_path, "libs/domain/src/pkg/mod.py", 'print("x")\n')
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert relative in output


def test_the_line_cap_is_exactly_where_it_says_it_is(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """Both sides of the boundary, so the cap cannot quietly become 300.

    A rule that fires is not evidence of the number it fires at, and rule 6 is
    the one rule in here whose number is a judgement rather than a mechanism.

    The 400 is written out rather than taken from `MAX_FILE_LINES`, because a
    test that builds its fixture from the constant moves whenever the constant
    does and pins nothing at all. That was the first version of this test and
    it survived exactly the mutation it was written to catch.
    """
    assert MAX_FILE_LINES == 400

    at_the_cap = "".join(f"x{n} = {n}\n" for n in range(400))
    write(tmp_path, "services/svc/src/pkg/exactly.py", at_the_cap)
    code, output = run(tmp_path, capsys)
    assert code == 0, output
    assert scanned_count(output) == 1

    write(tmp_path, "services/svc/src/pkg/exactly.py", at_the_cap + "one_too_many = 1\n")
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert "[file-length]" in output
    assert "401 lines" in output


# --- D1: the shapes a banned name can arrive in -----------------------------


def test_the_one_token_rename_does_not_get_past_the_name_rules(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """The file that scored exit 0 against the adjacency scan.

    Every banned name here is followed by something other than `(`:
    `from sqlalchemy import text as sql` is the conventional SQLAlchemy import
    rather than an evasion, `_emit = print` is a rename, and
    `savepoint = session.begin_nested` defers the call by one line. Rule 3 —
    tenant scoping — is the one that was lost.
    """
    relative = write(
        tmp_path,
        "services/svc/src/pkg/evade.py",
        "from sqlalchemy import text as sql\n"
        "_emit = print\n"
        "\n"
        "\n"
        "def all_orders(session, tenant):\n"
        "    stmt = sql(f\"select * from orders where tenant_id = '{tenant}'\")\n"
        "    rows = session.execute(stmt).all()\n"
        "    _emit(rows)\n"
        "    return rows\n"
        "\n"
        "\n"
        "def nested(session):\n"
        "    savepoint = session.begin_nested\n"
        "    with savepoint():\n"
        "        pass\n",
    )
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert "[raw-sql]" in output
    assert "[print]" in output
    assert "[savepoint]" in output
    assert f"{relative}:1" in output
    assert f"{relative}:2" in output
    assert f"{relative}:13" in output


@pytest.mark.parametrize(
    ("rule_id", "source"),
    [
        # Imports, in every spelling. The alias form is the one that made the
        # rest of the file invisible to the adjacency scan.
        ("raw-sql", "from sqlalchemy import text\n"),
        ("raw-sql", "from sqlalchemy import text as sa_text\n"),
        ("raw-sql", "import text\n"),
        ("raw-sql", "import sqlalchemy.text\n"),
        ("any-type", "from typing import Any\n"),
        ("any-type", "from typing import Any as AnyValue\n"),
        ("print", "from builtins import print as emit\n"),
        # Calls, bare and qualified.
        ("raw-sql", 'from sqlalchemy.sql import text\n\nq = text("select 1")\n'),
        ("savepoint", "def f(s):\n    return s.begin_nested()\n"),
        # `literal_column` is an exact synonym for `text` in injection terms and
        # went straight through the gate until it was named. It has no English
        # collision, so every shape fires: import, call, attribute read.
        ("raw-sql", "from sqlalchemy import literal_column\n"),
        (
            "raw-sql",
            "import sqlalchemy as sa\n"
            "\n"
            "\n"
            "def f(session):\n"
            '    cols = sa.literal_column("id, tenant_id")\n'
            "    return session.execute(sa.select(cols)).all()\n",
        ),
        ("raw-sql", 'def f(sa):\n    return sa.literal_column("id, tenant_id")\n'),
        # `raw_connection` is the one that leaves the ORM entirely — no tenant
        # filter, and none of the Session events that set the tenant GUC.
        (
            "raw-sql",
            "def f(engine):\n"
            "    cursor = engine.raw_connection().cursor()\n"
            '    return cursor.execute("SELECT id FROM orders")\n',
        ),
        ("raw-sql", "def f(engine):\n    borrow = engine.raw_connection\n    return borrow\n"),
        ("raw-sql", "from sqlalchemy.engine import raw_connection\n"),
        # References that are not calls.
        ("print", "def f(register):\n    register(print)\n"),
        ("print", "def f():\n    return print\n"),
        ("savepoint", "def f(s):\n    handle = s.begin_nested\n    return handle\n"),
        ("http-exception", "def f(exc):\n    return isinstance(exc, HTTPException)\n"),
        (
            "http-exception",
            "def f():\n    try:\n        pass\n    except HTTPException:\n        raise\n",
        ),
        # `Any` has to stay position-independent through the AST rewrite: an
        # annotation, a subscript and a default are all expressions.
        ("any-type", "def f(d: dict[str, Any]) -> None:\n    return None\n"),
        ("any-type", "Alias = list[Any]\n"),
        ("any-type", "def f() -> Any:\n    return 1\n"),
    ],
)
def test_a_banned_name_fires_in_every_shape_the_gate_claims(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], rule_id: str, source: str
) -> None:
    write(tmp_path, "services/svc/src/pkg/shapes.py", source)
    code, output = run(tmp_path, capsys)
    assert code != 0, output
    assert f"[{rule_id}]" in output


@pytest.mark.parametrize(
    "source",
    [
        # An attribute read that is data, not a SQLAlchemy construct. This is
        # why `text` alone is exempt from the attribute-reference shape.
        "def f(response):\n    body = response.text\n    return body\n",
        # A parameter named `text`, and every read of it.
        "def render(text: str) -> str:\n    return text.upper()\n",
        "def render(text: str) -> str:\n    return text\n",
        # A local named `text`.
        'def build() -> str:\n    text = "hello"\n    return text\n',
        # A keyword argument is a parameter name at the call site, not a value.
        'def f(widget):\n    widget.draw(text="hello")\n',
        # An attribute assignment stores to `.text`; it does not read it.
        'def f(node):\n    node.text = "hello"\n',
        # Definitions of something else that happens to share the word, and —
        # the part that matters — a *read* of what they bound. The earlier rows
        # here were `def text(value): return value` and `class Text: pass`, and
        # neither one provided the coverage it looked like: the first never read
        # `text` back, and the second named something that is not a banned name
        # at all. Deleting the `FunctionDef`/`AsyncFunctionDef`/`ClassDef`
        # binding branch outright left all 117 tests passing while making
        # `handler = cast` after a local `def cast` a false positive.
        "def cast(value: str, kind: type) -> object:\n"
        "    return kind(value)\n"
        "\n"
        "\n"
        "CONVERTERS = [cast]\n",
        "async def text(value: str) -> str:\n"
        "    return value\n"
        "\n"
        "\n"
        "RENDERERS = [text]\n",
        "class Any:\n"
        '    """A marker meaning no constraint. Not typing.Any."""\n'
        "\n"
        "\n"
        "MATCH_ALL = Any\n",
        # A `for`/`with`/`except` target is a binding like any other.
        "def f(rows):\n    for text in rows:\n        yield text\n",
        "def f(cm):\n    with cm as text:\n        return text\n",
        "def f():\n    try:\n        pass\n    except ValueError as text:\n        return text\n",
    ],
)
def test_a_collision_with_a_common_word_does_not_fire(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], source: str
) -> None:
    """The other half of the boundary, and the half that decides whether the
    gate survives contact with people. `text` is an English word."""
    write(tmp_path, "services/svc/src/pkg/collide.py", source)
    code, output = run(tmp_path, capsys)
    assert code == 0, output
    assert scanned_count(output) == 1


def test_a_call_is_still_a_call_when_the_parenthesis_is_not_adjacent(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """Inside brackets a comment and a newline are whitespace, so the `(` can
    be arbitrarily far from the name it calls. The adjacency scan needed a list
    of insignificant token types to see this; the parser needs nothing."""
    relative = write(
        tmp_path,
        "services/svc/src/pkg/spaced.py",
        "value = (\n"
        "    print\n"
        "    # a comment sitting between the name and its parenthesis\n"
        '    ("hello")\n'
        ")\n",
    )
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert "[print]" in output
    assert relative in output


def test_an_import_binding_does_not_excuse_the_uses_that_follow_it(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """An import is the banned thing arriving, not the file coining a word.

    Adding `ast.alias` to the binding set left all 117 tests passing, because
    every one of them either imported a banned name without reading it back or
    read one without importing it. What the mutation actually did was turn

        from typing import Any  # rules-allow(any-type): <a real reason>

    into a whole-file licence for `Any` — one reason, written about the import,
    silently answering for every use below it. That is the file-form exemption
    granted by accident and without the word `file` appearing anywhere.

    So both files here bind by import *and then reference*. `licensed.py` is
    the laundering case and is the one that reported zero violations under the
    mutation.
    """
    plain = write(
        tmp_path,
        "services/svc/src/pkg/imported.py",
        "from typing import Any\n\n\ndef f(value: Any) -> Any:\n    return value\n",
    )
    licensed = write(
        tmp_path,
        "services/svc/src/pkg/licensed.py",
        f"from typing import Any  # rules-allow(any-type): {GOOD_REASON}\n"
        "\n"
        "\n"
        "def f(value: Any) -> Any:\n"
        "    return value\n",
    )
    code, output = run(tmp_path, capsys)
    assert code != 0

    # The import itself, then both annotations on the signature line.
    assert f"{plain}:1" in output
    assert output.count(f"{plain}:4") == 2

    # The allow covers its own line and nothing below it.
    assert f"{licensed}:1" not in output
    assert output.count(f"{licensed}:4") == 2


# --- the scope exemptions do not fire ---------------------------------------


def test_raw_sql_is_allowed_inside_a_db_package(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """`SET LOCAL`, health checks and migrations have to be raw. They live in
    one reviewed place."""
    write(
        tmp_path, "services/svc/src/pkg/db/session.py", 'import sqlalchemy as sa\n\nsa.text("x")\n'
    )
    code, output = run(tmp_path, capsys)
    assert code == 0, output
    assert scanned_count(output) > 0


def test_the_db_carve_out_covers_the_whole_raw_sql_rule_and_not_just_text(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """`literal_column` and `raw_connection` are under rule 3, so they are under
    rule 3's carve-out. That is deliberate and it is where the review has to
    happen: a pool health check is a plausible reason to want a DBAPI
    connection, and `db/` is the one place a reviewer looks for it."""
    write(
        tmp_path,
        "services/svc/src/pkg/db/health.py",
        "import sqlalchemy as sa\n"
        "\n"
        "\n"
        "def check(engine):\n"
        "    raw = engine.raw_connection()\n"
        '    return sa.select(sa.literal_column("1")), raw\n',
    )
    code, output = run(tmp_path, capsys)
    assert code == 0, output
    assert scanned_count(output) > 0


def test_the_http_exception_type_is_allowed_in_the_mapping_layer(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write(tmp_path, "services/svc/src/pkg/api/errors.py", "from fastapi import HTTPException\n")
    code, output = run(tmp_path, capsys)
    assert code == 0, output
    assert scanned_count(output) > 0


def test_a_path_exemption_does_not_reach_a_directory_that_merely_ends_in_it(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """`relative.endswith("api/errors.py")` exempted `notapi/errors.py`, which
    is a module anyone can create by naming a package `notapi` — or `webapi`,
    or `internalapi`."""
    relative = write(
        tmp_path,
        "services/svc/src/pkg/notapi/errors.py",
        "from fastapi import HTTPException\n\n\ndef f():\n    raise HTTPException(400)\n",
    )
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert "[http-exception]" in output
    assert relative in output


def test_the_raw_sql_carve_out_does_not_reach_a_db_directory_at_any_depth(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """The carve-out is for *the* `db` package, the one directly inside the
    distribution package that owns `SET LOCAL` and the health check. A `db`
    directory under `api/` holds route handlers, which is exactly the code
    rule 3 exists to keep tenant-scoped."""
    relative = write(
        tmp_path,
        "services/svc/src/pkg/api/db/routes.py",
        'import sqlalchemy as sa\n\nq = sa.text("select 1")\n',
    )
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert "[raw-sql]" in output
    assert relative in output


PROBE_MODULE = (
    "from sqlalchemy import text\n"
    "\n"
    "\n"
    "def all_orders(session):\n"
    '    rows = session.execute(text("SELECT * FROM orders")).all()\n'
    "    print(rows)\n"
    "    return rows\n"
)


def test_a_tests_package_inside_src_is_scanned_like_any_other_module(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """`tests` was a skipped directory name, and it excused a real package.

    MEASURED before the fix: the left-hand file below scanned clean while the
    identical body one directory over was caught, and the run reported a
    scanned count of 1. `titlepipe_probe.tests.queries` imports and runs like
    any other module — it is shipped code that happens to sit in a directory
    with a reassuring name.

    The skip was aimed at the *test suite*, and the test suite is at
    `services/*/tests`, beside `src/` and outside the scan roots, so it needed
    no skip name to stay out. The name only ever covered the case it should not
    have. Both files must now be scanned and both must report all three
    violations.
    """
    inside = write(tmp_path, "services/probe/src/titlepipe_probe/tests/queries.py", PROBE_MODULE)
    beside = write(tmp_path, "services/probe/src/titlepipe_probe/api/control.py", PROBE_MODULE)
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert scanned_count(output) == 2
    for relative in (inside, beside):
        assert f"{relative}:1" in output, output
        assert f"{relative}:5" in output, output
        assert f"{relative}:6" in output, output


def test_a_tests_package_inside_src_can_still_earn_an_exemption(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """The replacement for the blanket skip. A `src/**/tests/` package that
    genuinely needs raw SQL says so once, in the file, naming the rule — which
    is a reviewable sentence rather than a directory name nobody re-reads."""
    write(
        tmp_path,
        "services/probe/src/titlepipe_probe/tests/queries.py",
        f"# rules-allow-file(raw-sql): {GOOD_REASON}\n"
        "from sqlalchemy import text\n"
        "\n"
        "\n"
        "def all_orders(session):\n"
        '    return session.execute(text("SELECT * FROM orders")).all()\n',
    )
    code, output = run(tmp_path, capsys)
    assert code == 0, output
    assert scanned_count(output) == 1


def test_where_the_checkout_lives_cannot_change_what_is_scanned(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """Skipped directory names were matched against the *absolute* path, so a
    clone under any ancestor called `venv`, `node_modules` or a cache directory
    scanned zero files and reported clean. A scratch worktree at `~/venv/proj`
    is not a hypothetical."""
    inside = tmp_path / "venv" / ".ruff_cache" / "node_modules" / "proj"
    elsewhere = tmp_path / "plain" / "proj"
    offender = "from typing import Any\n\nv: Any = 1\nprint(v)\n"
    write(inside, "services/svc/src/pkg/m.py", offender)
    write(elsewhere, "services/svc/src/pkg/m.py", offender)

    inside_code, inside_output = run(inside, capsys)
    elsewhere_code, elsewhere_output = run(elsewhere, capsys)

    assert inside_code == elsewhere_code != 0
    assert scanned_count(inside_output) == scanned_count(elsewhere_output) == 1
    assert "[any-type]" in inside_output
    assert "[print]" in inside_output


# --- near-miss tokens do not fire -------------------------------------------


def test_names_that_merely_contain_a_banned_name_do_not_fire(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """`libs/domain/src/titlepipe_domain/redaction.py` calls `scrub_text(` four
    times. A substring search for `text(` flags every one of them."""
    write(
        tmp_path,
        "services/svc/src/pkg/near_miss.py",
        "def scrub_text(value: str) -> str:\n"
        "    return value\n"
        "\n"
        "\n"
        "def context(value: str) -> str:\n"
        "    return scrub_text(value)\n"
        "\n"
        "\n"
        "def plaintext(value: str) -> str:\n"
        "    return context(value)\n"
        "\n"
        "\n"
        "class Anything:\n"
        "    company = 'Company'\n"
        "\n"
        "\n"
        "def pprint(value: str) -> str:\n"
        "    return value\n"
        "\n"
        "\n"
        "def raw_connection_url(dsn: str) -> str:\n"
        "    return dsn\n"
        "\n"
        "\n"
        "def literal_columns(names: list[str]) -> list[str]:\n"
        "    return names\n",
    )
    code, output = run(tmp_path, capsys)
    assert code == 0, output
    assert scanned_count(output) > 0


def test_the_qualified_forms_still_fire(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    """The other direction of the same rule: an attribute access is a call.

    The counts are exact because the parser sees one node in two roles — the
    `func` of a `Call` is also an `Attribute` — and reporting it twice would be
    a report nobody trusts."""
    relative = write(
        tmp_path,
        "services/svc/src/pkg/qualified.py",
        "def f(sa: object, session: object) -> None:\n"
        '    sa.text("select 1")\n'
        '    session.exec_driver_sql("select 1")\n',
    )
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert output.count(f"{relative}:2") == 1
    assert output.count(f"{relative}:3") == 1


def test_prose_in_a_comment_or_docstring_is_not_code(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """Both of these are in the tree today: `errors.py` documents that domain
    code never raises the HTTP exception type, and `settings.py` has a comment
    starting "Any of them in a deployed …". A rule that flags the sentence
    documenting the rule gets the sentence deleted."""
    write(
        tmp_path,
        "services/svc/src/pkg/prose.py",
        '"""Domain code never raises HTTPException and never calls print(.\n'
        "\n"
        "Any of these would be a defect; so would cast( or text(.\n"
        '"""\n'
        "\n"
        "# Any of them in a deployed environment is a mistake.\n"
        "value = 1\n",
    )
    code, output = run(tmp_path, capsys)
    assert code == 0, output
    assert scanned_count(output) > 0


# --- D3: the suppressions that are comments ---------------------------------


@pytest.mark.parametrize(
    "comment",
    [
        "# type: ignore",
        "# type: ignore[return-value]",
        "# pyright: ignore",
        "# pyright: ignore[reportUnknownVariableType, reportUnknownArgumentType]",
        "# pyright: basic",
        "# pyright: standard",
        "# pyright: reportCallIssue=false",
        "# pyright: reportUnknownMemberType = false",
        # PEP-484 type comments: an annotation written where the parser for
        # annotations never looks.
        "# type: (int, str) -> Any",
        "# type: (Any) -> None",
    ],
)
def test_every_way_of_turning_the_type_checker_off_is_the_same_rule(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], comment: str
) -> None:
    """This repository type-checks with pyright in strict mode. A gate that
    bans `# type: ignore` and not `# pyright: ignore` bans the spelling nobody
    here uses."""
    relative = write(tmp_path, "services/svc/src/pkg/silenced.py", f"value = 1  {comment}\n")
    code, output = run(tmp_path, capsys)
    assert code != 0, output
    assert "[any-type]" in output
    assert relative in output


@pytest.mark.parametrize(
    "comment",
    [
        # `strict` tightens. The rule is about loosening without a record.
        "# pyright: strict",
        # A type comment with no `Any` in it erases nothing.
        "# type: (int, str) -> bool",
        # Prose that happens to contain the word.
        "# the settings type is awkward but every field is checked",
    ],
)
def test_a_comment_that_turns_nothing_off_is_not_a_violation(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], comment: str
) -> None:
    write(tmp_path, "services/svc/src/pkg/fine.py", f"value = 1  {comment}\n")
    code, output = run(tmp_path, capsys)
    assert code == 0, output
    assert scanned_count(output) == 1


# --- exemptions -------------------------------------------------------------


def test_a_line_allow_suppresses_the_violation_on_its_line(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write(
        tmp_path,
        "services/svc/src/pkg/allowed.py",
        f"from typing import cast  # rules-allow(any-type): {GOOD_REASON}\n"
        "\n"
        f'v = cast("int", 1)  # rules-allow(any-type): {GOOD_REASON}\n',
    )
    code, output = run(tmp_path, capsys)
    assert code == 0, output
    assert scanned_count(output) > 0


def test_a_line_allow_does_not_reach_the_next_line(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    relative = write(
        tmp_path,
        "services/svc/src/pkg/scoped.py",
        f"from typing import cast  # rules-allow(any-type): {GOOD_REASON}\n"
        f'a = cast("int", 1)  # rules-allow(any-type): {GOOD_REASON}\n'
        'b = cast("int", 2)\n',
    )
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert f"{relative}:3" in output
    assert f"{relative}:2" not in output


def test_a_line_allow_covers_only_the_rule_it_names(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """The laundering hole. Keyed on the line number alone, one honest reason
    exempted everything that shared its physical line — here a reason about a
    `cast` bought an unredacted `print` of a name."""
    relative = write(
        tmp_path,
        "services/svc/src/pkg/launder.py",
        f"from typing import cast  # rules-allow(any-type): {GOOD_REASON}\n"
        "\n"
        "\n"
        "def f(rows, name):\n"
        '    n = cast("int", rows); print(name)  '
        f"# rules-allow(any-type): {GOOD_REASON}\n"
        "    return n\n",
    )
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert "[print]" in output
    assert "[any-type]" not in output
    assert output.count(f"{relative}:5") == 1


def test_the_rule_less_line_form_exempts_nothing_and_says_to_name_a_rule(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """`# rules-allow: <reason>` used to exempt the whole line. It is rejected
    rather than reinterpreted — guessing which rule the author meant is how a
    reason ends up answering for a violation nobody read."""
    relative = write(
        tmp_path,
        "services/svc/src/pkg/unnamed.py",
        f"def f(name):\n    print(name)  # rules-allow: {GOOD_REASON}\n",
    )
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert "[rules-allow]" in output
    assert "does not name a rule" in output
    assert "[print]" in output
    assert output.count(f"{relative}:2") == 2


def test_a_short_allow_does_not_suppress_what_it_sits_on(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """Rule 7 is decorative if a rejected exemption still exempts. Two
    violations must be reported on this line, not one and not none."""
    relative = write(
        tmp_path,
        "services/svc/src/pkg/terse.py",
        f"from typing import cast  # rules-allow(any-type): {GOOD_REASON}\n"
        "\n"
        'v = cast("int", 1)  # rules-allow(any-type): nope\n',
    )
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert "[rules-allow]" in output
    assert "[any-type]" in output
    assert output.count(f"{relative}:3") == 2


def test_the_allow_reason_floor_is_exactly_where_it_says_it_is(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """Both sides of rule 7's boundary, the way rule 6 already had.

    Rule 6 got the boundary treatment and rule 7 did not: the only fixtures in
    this file were 5 and 7 characters and the good reason is 74, so nothing sat
    either side of 12 and `MIN_ALLOW_REASON_LENGTH = 30` passed all 117 tests.
    A cap of 30 is not obviously wrong — it is just not the cap that is written
    down, and the whole point of a number in an enforcement script is that it
    is the number everyone was told.

    The two reasons are written out as literals rather than built from the
    constant, for the same reason `test_the_line_cap_...` writes out 400: a
    fixture derived from the constant moves with it and pins nothing.
    """
    assert MIN_ALLOW_REASON_LENGTH == 12

    exactly_twelve = "pooled reuse"
    one_short = "pooled reus"
    assert len(exactly_twelve) == 12
    assert len(one_short) == 11

    write(
        tmp_path,
        "services/svc/src/pkg/floor.py",
        f'v = cast("int", 1)  # rules-allow(any-type): {exactly_twelve}\n',
    )
    code, output = run(tmp_path, capsys)
    assert code == 0, output
    assert scanned_count(output) == 1

    relative = write(
        tmp_path,
        "services/svc/src/pkg/floor.py",
        f'v = cast("int", 1)  # rules-allow(any-type): {one_short}\n',
    )
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert "[rules-allow]" in output
    # And it does not suppress what it sits on: the rejected exemption plus the
    # `cast` it failed to excuse, both on line 1.
    assert "[any-type]" in output
    assert output.count(f"{relative}:1") == 2


def test_the_line_form_cannot_grant_a_rule_that_is_about_the_whole_file(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """A silent no-op, and the wrong kind of silent.

    `# rules-allow(file-length): …` parsed, passed rule 7, and was recorded as
    an accepted exemption — and was then never consulted, because a file-length
    violation carries `line=0` and is only ever tested against the file-form
    set. It failed closed, so nothing leaked; what it cost was an author
    staring at a rejected file next to a reason they had written that appeared
    to do nothing. It is now refused by name, pointing at the form that works.
    """
    write(
        tmp_path,
        "services/svc/src/pkg/wrong_form.py",
        f"# rules-allow(file-length): {GOOD_REASON}\n"
        + "".join(f"x{n} = {n}\n" for n in range(401)),
    )
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert "[rules-allow]" in output
    assert "can never grant it" in output
    assert "rules-allow-file(file-length)" in output
    # And the rule it failed to grant still fires.
    assert "[file-length]" in output


def test_a_line_allow_naming_an_unknown_rule_is_a_violation(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    relative = write(
        tmp_path,
        "services/svc/src/pkg/line_typo.py",
        f"def f(name):\n    print(name)  # rules-allow(printing): {GOOD_REASON}\n",
    )
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert "unknown rule id" in output
    assert "[print]" in output
    assert relative in output


def test_a_malformed_line_allow_is_a_violation(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write(
        tmp_path,
        "services/svc/src/pkg/line_unclosed.py",
        f"def f(name):\n    print(name)  # rules-allow(print: {GOOD_REASON}\n",
    )
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert "malformed exemption" in output
    assert "[print]" in output


def test_a_file_allow_covers_a_rule_that_is_attached_to_no_line(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """Rule 6's whole reason for needing a file-level form."""
    long_source = f"# rules-allow-file(file-length): {GOOD_REASON}\n" + "".join(
        f"x{n} = {n}\n" for n in range(401)
    )
    write(tmp_path, "services/svc/src/pkg/long.py", long_source)
    code, output = run(tmp_path, capsys)
    assert code == 0, output
    assert scanned_count(output) > 0


def test_a_file_allow_covers_only_the_rule_it_names(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """A file excused for one rule must not acquire a licence for the rest."""
    relative = write(
        tmp_path,
        "services/svc/src/pkg/narrow.py",
        f"# rules-allow-file(any-type): {GOOD_REASON}\n"
        "from typing import Any\n"
        "\n"
        "\n"
        "def f() -> Any:\n"
        '    print("leaked")\n',
    )
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert "[print]" in output
    assert "[any-type]" not in output
    assert f"{relative}:6" in output


def test_a_file_allow_naming_an_unknown_rule_is_a_violation(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """A typo in an exemption is a rule that silently stopped running."""
    relative = write(
        tmp_path,
        "services/svc/src/pkg/typo.py",
        f"# rules-allow-file(any_type): {GOOD_REASON}\nfrom typing import Any\n\nv: Any = 1\n",
    )
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert relative in output
    assert "unknown rule id" in output
    assert "[any-type]" in output


def test_a_malformed_file_allow_is_a_violation(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """An unclosed parenthesis names no rule, so it can exempt no rule. It must
    not fall through to the line form or to silence."""
    relative = write(
        tmp_path,
        "services/svc/src/pkg/unclosed.py",
        f"# rules-allow-file(any-type: {GOOD_REASON}\nfrom typing import Any\n\nv: Any = 1\n",
    )
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert "malformed exemption" in output
    assert "[any-type]" in output
    assert relative in output


def test_the_marker_in_neither_form_is_a_violation(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """No colon and no parenthesis. Somebody reached for the marker and stopped
    short of a form, which must not read as a pass."""
    relative = write(
        tmp_path,
        "services/svc/src/pkg/formless.py",
        "value = 1  # rules-allow this is fine\n",
    )
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert "[rules-allow]" in output
    assert "neither form" in output
    assert relative in output


def test_a_short_file_allow_reason_neither_exempts_nor_passes(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write(
        tmp_path,
        "services/svc/src/pkg/terse_file.py",
        "# rules-allow-file(any-type): short\nfrom typing import Any\n\nv: Any = 1\n",
    )
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert "[rules-allow]" in output
    assert "[any-type]" in output


# --- the clean case ---------------------------------------------------------


def test_a_clean_tree_exits_zero_having_actually_scanned_something(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """The assertion that makes every other clean-tree test above mean anything.
    Without the count, a scanner that found no files at all passes them all."""
    write(tmp_path, "services/svc/src/pkg/__init__.py", "")
    write(
        tmp_path,
        "services/svc/src/pkg/clean.py",
        "from titlepipe_domain import TENANT_GUC\n\nGUC = TENANT_GUC\n",
    )
    write(tmp_path, "libs/lib/src/pkg/clean.py", "value: int = 1\n")
    code, output = run(tmp_path, capsys)
    assert code == 0, output
    assert scanned_count(output) == 3


def test_a_byte_order_mark_is_not_a_parse_failure(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """`tokenize` tolerates a leading BOM; `ast.parse` calls it an invalid
    non-printable character. Moving the name rules onto the parser would have
    turned every BOM-prefixed file in the tree into a `[parse]` violation."""
    path = tmp_path / "services/svc/src/pkg/bom.py"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"\xef\xbb\xbfvalue = 1\n")
    code, output = run(tmp_path, capsys)
    assert code == 0, output
    assert scanned_count(output) == 1


# --- finding nothing is a failure -------------------------------------------


def test_an_empty_tree_is_a_failure_rather_than_a_pass(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """The failure this script is most likely to have. It used to exit 0 with a
    count of 0, which is indistinguishable from a clean tree to anything that
    reads only the exit code — which is everything that runs it."""
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert scanned_count(output) == 0
    assert "has not checked it" in output


def test_a_root_that_does_not_exist_is_a_failure(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    code, output = run(tmp_path / "no" / "such" / "place", capsys)
    assert code != 0
    assert scanned_count(output) == 0


def test_a_root_pointing_at_one_service_is_a_failure(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """`cd services/core-api && python ../../scripts/check_backend_rules.py .`
    is the exact invocation. The globs are repository-relative, so from inside
    a service they match nothing at all."""
    write(tmp_path, "services/svc/src/pkg/m.py", 'print("x")\n')
    code, output = run(tmp_path / "services" / "svc", capsys)
    assert code != 0
    assert scanned_count(output) == 0
    assert "no source tree" in output


def test_scan_roots_that_hold_no_python_are_a_failure(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """A root that exists but is empty of anything scannable is still a scan of
    nothing, and is reported differently from a root that does not exist so
    that the two are not debugged as the same problem.

    The unscannable file is under `.venv/` rather than `tests/`: `tests` is no
    longer a skipped name, and a fixture that quietly stopped being skipped
    would turn this into a test of nothing."""
    (tmp_path / "services" / "svc" / "src").mkdir(parents=True)
    write(tmp_path, "services/svc/src/.venv/lib/pkg/m.py", 'print("x")\n')
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert scanned_count(output) == 0
    assert "nothing to scan" in output


def test_the_default_root_is_the_repository_and_not_the_working_directory(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """The one test that runs against the real tree, and the only way to
    exercise `REPO_ROOT` at all: every other test passes an explicit root, so a
    wrong number of `.parent` calls would go unnoticed by all of them.

    It runs the script twice for two different reasons.

    In-process, `main([])` catches a wrong number of `.parent` calls — that is
    all the earlier version of this test ever caught, despite its name.
    `REPO_ROOT = Path.cwd()` passed it, and passed all 117 tests, because
    pytest is invoked from the repository root and there the two expressions
    are equal. cwd is the substitution the module docstring names as the
    failure this constant exists to prevent, so the test named after it has to
    actually fail on it.

    It cannot be caught in-process: `REPO_ROOT` is bound when the module is
    imported, and by then pytest's cwd is already the repository root — a
    `monkeypatch.chdir` afterwards moves nothing. So the second run is a
    subprocess started from somewhere else, which is also the documented
    invocation (`../../scripts/check_backend_rules.py` from a service
    directory). Under the cwd form it scans an empty tmp directory, finds zero
    files, and this fails.

    Both assert the count and nothing about the verdict. Whether the backend is
    currently clean is not this test's business, and making it so would couple
    the guard's suite to the code it guards.
    """
    main([])
    assert scanned_count(capsys.readouterr().out) > 0

    script = Path(__file__).resolve().parent.parent / "check_backend_rules.py"
    elsewhere = subprocess.run(
        [sys.executable, str(script)],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
    )
    assert scanned_count(elsewhere.stdout) > 0, elsewhere.stdout + elsewhere.stderr


def test_unparseable_source_is_reported_rather_than_skipped(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """A file the scanner cannot read is a file none of the rules ran against."""
    relative = write(tmp_path, "services/svc/src/pkg/broken.py", "def f(:\n")
    code, output = run(tmp_path, capsys)
    assert code != 0
    assert relative in output
    assert "[parse]" in output


def test_undecodable_bytes_are_reported_without_taking_the_run_down(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """A `# -*- coding: latin-1 -*-` module with one high byte raised an
    uncaught `UnicodeDecodeError` out of `main`, so *no* file got a report and
    the exit code came from the traceback. The rest of the tree still has to be
    scanned, which is why the count is asserted."""
    path = tmp_path / "services/svc/src/pkg/latin.py"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b'# -*- coding: latin-1 -*-\nCAFE = "caf\xe9"\n')
    other = write(tmp_path, "services/svc/src/pkg/other.py", 'print("x")\n')

    code, output = run(tmp_path, capsys)
    assert code != 0
    assert "[parse]" in output
    assert "services/svc/src/pkg/latin.py" in output
    # The scan kept going: the file after the undecodable one was still read.
    assert scanned_count(output) == 2
    assert f"{other}:1" in output


def test_a_broken_symlink_is_reported_without_taking_the_run_down(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """`OSError` was not caught, so the handler still had the failure mode it
    was written to remove.

    MEASURED before the fix: a dangling `.py` symlink under a scan root raised
    `FileNotFoundError` out of `main`, printed a traceback, and reported *no*
    file at all — the exact outcome the docstring beside the `UnicodeDecodeError`
    handler says it exists to prevent. A stale editable install and a
    half-restored CI cache both produce one, and in pre-commit the gate then
    failed with an errno instead of a filename.

    The count is asserted because a fix that silently skipped the unreadable
    path would pass every other assertion here.
    """
    package = tmp_path / "services/svc/src/pkg"
    package.mkdir(parents=True)
    (package / "stale.py").symlink_to(tmp_path / "gone" / "target.py")
    other = write(tmp_path, "services/svc/src/pkg/other.py", 'print("x")\n')

    code, output = run(tmp_path, capsys)
    assert code != 0
    assert "[parse]" in output
    assert "services/svc/src/pkg/stale.py" in output
    assert "could not be read" in output
    assert scanned_count(output) == 2
    assert f"{other}:1" in output


def test_a_directory_named_like_a_module_is_reported_without_taking_the_run_down(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """The second uncaught `OSError`, and the one nobody expects.

    MEASURED before the fix: a directory called `weird.py` — `rglob("*.py")`
    matches directories too — raised `IsADirectoryError` and aborted the run.
    It is reported rather than filtered out for the same reason the symlink is:
    a scan root in a state the scanner cannot make sense of is a fact about the
    checkout, and swallowing it is how a gate reports clean on a tree it never
    read. The module *inside* it is still scanned.
    """
    inner = write(tmp_path, "services/svc/src/pkg/weird.py/inner.py", 'print("x")\n')

    code, output = run(tmp_path, capsys)
    assert code != 0
    assert "[parse]" in output
    assert "services/svc/src/pkg/weird.py" in output
    assert "could not be read" in output
    assert scanned_count(output) == 2
    assert f"{inner}:1" in output
