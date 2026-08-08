"""`GET /api/rules` over HTTP — the route, its wiring, and the two ways it fails.

`tests/test_rules_contract_parity.py` proves the SHAPE: that the committed
fixture is what today's models serialise, and that the read path
(`RuleRepository.list_all` -> `from_rows` -> `model_dump_json`) produces those
exact bytes out of a real `postgres:18.4`. It stops one hop short of the wire,
because until this task there was no route to drive. This file takes the hop.

## What each test would score against a broken-in-the-obvious-way service

`00-HOW-TO-EXECUTE.md` §1.1 is about a suite of denials scoring full marks
against a mechanism that had been torn out, so each failure test here has a named
partner that points the other way:

* the two failure tests answer 503. **A route that raised
  `DependencyUnavailableError` unconditionally would pass both of them**, and
  `test_the_route_answers_the_committed_fixture_byte_for_byte` is the control
  that fails: it is the only test in this file that asserts rows;
* that byte comparison would in turn be satisfied by a route that hard-coded the
  fixture's contents. What stops it is that the rows are SEEDED into PostgreSQL
  by `_seed_the_committed_fixture` and come back through the real repository —
  and `test_a_role_that_may_not_read_rules_answers_the_error_envelope` connects
  to the same live database as a role holding no grant on the table, so a route
  that never opened a connection could not tell the two apart.

## The seed reads the committed fixture, and that is why it is not the parity
## module's seeder

`test_rules_contract_parity.py::_seed_the_fixture_rows` writes the rows its
`_sample_rows()` builds — the MODELS' authority — and compares the serialisation
to the file. This one writes the FILE's rows and compares the response to the
file, which makes the assertion an end-to-end identity over a document neither
end constructed. That module already rules on when two seeders may coexist, of
its own seeder and `conftest._seed_isolation_rows`: "they are not one helper
because that one chooses rows for an ORDERING proof and this one must write the
fixture's exact five." Same rule, third instance.

`created_at` is left to the server default in both, so the column the contract
does not have is genuinely dropped by the model rather than never written.

## No auth, and that is asserted rather than assumed

`mock_auth_enabled` is `False` in every app built here — it is the default and it
is passed nowhere — and no request below sends a header, a cookie or a
credential of any kind. So a 200 is a 200 for a caller with no principal at all.
The day somebody adds `if settings.mock_auth_enabled` to this route to make an
imagined admin work, `test_the_route_answers_the_committed_fixture_byte_for_byte`
is what fails, because it never sets the flag.
"""

from __future__ import annotations

import json
import re
import socket
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Final
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# `httpx2`, not `httpx`. Starlette 1.1's `TestClient` targets httpx2 and plain
# httpx is deprecated there — `pyproject.toml` records it in the dev group — so
# `httpx` is not installed at all and its name in the stub's return annotation is
# an alias. Named here because a response type is the one thing a test helper has
# to spell.
from httpx2 import Response
from pydantic import SecretStr, TypeAdapter
from sqlalchemy import Engine, text

from titlepipe_core.app import create_app
from titlepipe_core.db import make_engine, make_sessionmaker
from titlepipe_core.lifespan import DATABASE_CHECK, get_resources
from titlepipe_core.settings import CoreApiSettings
from titlepipe_domain import DependencyUnavailableError, Environment, LogRenderer
from titlepipe_test_support import FrozenClock, SequenceIdFactory

# `parents[3]` is the repository root: tests -> core-api -> services -> root.
# Spelled here as `test_rules_contract_parity.py` spells it, rather than reached
# through a shared fixture: the two modules are two independent readers of one
# committed artifact, and a helper between them would make one of them look like
# the other's private detail.
FIXTURE: Final = Path(__file__).resolve().parents[3] / "contract-fixtures" / "rules-response.json"

RULES_PATH: Final = "/api/rules"

# `libs/domain/errors.py::DependencyUnavailableError.code`, read off the class
# rather than transcribed. This is the one place in this file where the value
# genuinely IS the code's, because what is being asserted is that the ENVELOPE
# carries the domain error's own code — not that the code has some literal
# spelling, which is `libs/domain/tests`' question.
DEPENDENCY_UNAVAILABLE: Final = DependencyUnavailableError.code

# The correlation id `RequestContextMiddleware` stamps, as a shape rather than a
# value: `SequenceIdFactory` makes it predictable in-process, but the property
# the envelope must have is that the header and the body agree, and comparing
# them to each other is what says so.
UUID_OR_SEQUENCE: Final = re.compile(r"\A[0-9a-zA-Z_-]{3,}\Z")

# The order the seed WRITES the fixture's rows in, as indices into
# `fixture["rules"]`. It matches no sort key — the same device, and the same
# reason, as `test_rules_contract_parity.py::SEED_WRITE_ORDER`: a freshly written
# heap returns insertion order for an unqualified `SELECT`, so seeding in the
# fixture's own order would let a repository with no `order_by` pass.
SEED_WRITE_ORDER: Final = (2, 4, 1, 3, 0)

SEEDED_RULES: Final = 5

# Two `TypeAdapter`s, and they are here for a TYPING reason that is worth stating
# because the obvious spelling does not survive `pyright --strict`.
# `json.loads` answers `Any`; assigning that to an `object` and then narrowing it
# with `isinstance(value, dict)` gives `dict[Unknown, Unknown]`, and every
# subsequent read of an element is a `reportUnknown*` error — the exact hole
# `api/errors.py:199` documents, where seven rewrites moved the diagnostic
# without removing it and the file ended up carrying a suppression. The gate
# bans `# pyright: ignore` without a `rules-allow`, and a suppression in a test
# whose job is to read a JSON document is the wrong place to spend one.
#
# A `TypeAdapter` returns the declared type, so the documents below are typed all
# the way down with no narrowing and no suppression. It is Pydantic doing the
# parsing rather than `json`, which matters not at all to what is asserted: these
# shapes are `object`-valued, so nothing is coerced, and the ONE assertion the
# task specifies verbatim — `json.loads(response.content) == json.loads(fixture)`
# — is still made with `json.loads` on both sides, where no narrowing is needed
# because nothing is indexed.
_DOCUMENT: Final = TypeAdapter(dict[str, list[dict[str, object]]])
_ENVELOPE: Final = TypeAdapter(dict[str, dict[str, object]])
_LOG_RECORD: Final = TypeAdapter(list[dict[str, object]])


def _fixture_text() -> str:
    """The committed file, read with universal newlines.

    `.gitattributes` sets `* text=auto`, so a Windows checkout legitimately holds
    CRLF — the same concession `test_rules_contract_parity.py::_fixture_text`
    makes, and for the same reason.
    """
    return FIXTURE.read_text(encoding="utf-8")


def _fixture_document() -> dict[str, list[dict[str, object]]]:
    """The committed response body, parsed and typed.

    Parsed rather than compared as bytes, and that is not a weakening: `indent=2`
    and the trailing newline are FIXTURE formatting rather than wire formatting —
    the parity module says so where it writes them — and FastAPI emits compact
    JSON. What the comparison pins is the key set, the values and the null
    spellings. Key ORDER is pinned separately, because `==` on two dicts does not
    see it.
    """
    return _DOCUMENT.validate_json(_fixture_text())


def _seed_the_committed_fixture(engine: Engine) -> set[UUID]:
    """The fixture's five rows, committed, AS THE SUPERUSER, in `SEED_WRITE_ORDER`.

    AS THE SUPERUSER because `0003` grants `titlepipe_app` `SELECT ON rules` and
    nothing else — the role the route connects as cannot write the rows it reads,
    which is the correct shape for a table only a migration or an
    engineer-confirmed path may change.

    COMMITTED, because the reader is a different connection: the app's own
    `AsyncEngine`, opened by the lifespan, and an uncommitted row is invisible to
    it.

    `DELETE` first, so the contents are a function of this call rather than of
    whatever ran before it in the module.

    `created_at` IS LEFT TO THE SERVER DEFAULT and is deliberately not written.
    The wire must not carry it, so the comparison below holds only if the column
    is genuinely dropped by `RuleResponse`; a seeded value the response could
    match would make that pass for the wrong reason.

    Returns the ids `RETURNING` gave back, so the caller asserts what LANDED
    rather than what was sent. One statement per row: a `text()` executed with a
    list of parameter dictionaries is an executemany and RETURNING does not come
    back from one, measured in `conftest._seed_isolation_rows`.
    """
    rules = _fixture_document()["rules"]
    written: set[UUID] = set()
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM rules"))
        for index in SEED_WRITE_ORDER:
            row = rules[index]
            returned = connection.execute(
                text(
                    "INSERT INTO rules "
                    "(id, code, text, origin, status, jurisdiction_scope, version, "
                    " confirmed_by, source_doc_ref) "
                    "VALUES (:id, :code, :body, :origin, :status, :scope, :version, "
                    " :confirmed_by, :source_doc_ref) "
                    "RETURNING id"
                ),
                {
                    "id": row["id"],
                    "code": row["code"],
                    "body": row["text"],
                    "origin": row["origin"],
                    "status": row["status"],
                    "scope": row["jurisdiction_scope"],
                    "version": row["version"],
                    "confirmed_by": row["confirmed_by"],
                    "source_doc_ref": row["source_doc_ref"],
                },
            ).scalar_one()
            written.add(UUID(str(returned)))
    return written


def _settings(dsn: str | None) -> CoreApiSettings:
    """Test-environment settings, with or without a database.

    `mock_auth_enabled` is left at its `False` default and is passed nowhere —
    see this module's opening. `Environment.TEST` is not deployed, so none of
    `settings.py`'s deployed-configuration refusals apply and the only thing
    varying between the apps below is the DSN.
    """
    return CoreApiSettings(
        environment=Environment.TEST,
        app_database_url=None if dsn is None else SecretStr(dsn),
    )


def _app(dsn: str | None, clock: FrozenClock, id_factory: SequenceIdFactory) -> FastAPI:
    return create_app(_settings(dsn), clock=clock, id_factory=id_factory)


def _last_log_record(emitted: str, event: str) -> dict[str, object]:
    """The last JSON log line whose `event` is `event`.

    `LogRenderer.JSON` + `capsys` is `test_logging_pipeline.py::last_record`'s
    idiom; this one filters by event because a single request emits several
    lines and the one being asserted on is not always the last.

    It RAISES rather than returning `None` when nothing matches, and the message
    quotes what was emitted. A helper that answered `None` would make the
    assertions at its call sites read `record["error_name"] == ...` against an
    empty mapping, and "the route logged nothing at all" would surface as a
    `KeyError` several lines from the reason.
    """
    records = _LOG_RECORD.validate_json(f"[{','.join(emitted.strip().splitlines())}]")
    matching = [record for record in records if record.get("event") == event]
    if not matching:
        raise AssertionError(f"no {event!r} log record was emitted. Captured:\n{emitted}")
    return matching[-1]


def _closed_loopback_port() -> int:
    """A port on 127.0.0.1 with nothing listening on it.

    Bound and immediately released, so the number is one the kernel had free a
    moment ago rather than one chosen by hand. A hardcoded port is the version of
    this that passes for the wrong reason on the one machine where something is
    listening on it — and `playwright.live.config.ts` makes the same point about
    `VITE_API_UNREACHABLE_TARGET` in the other toolchain.

    The race — something binding it between the `close()` and the connect — is
    real and is bounded by being loopback-only and ephemeral-range. If it ever
    fires, the test fails by getting a 200 or a different error, not by passing.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


@pytest.fixture
def seeded_rulebook(migrated_database: str, seam_engine: Callable[[str], Engine]) -> set[UUID]:
    """The seed, with its premises asserted HERE before any request is made.

    The test this feeds compares two documents, and `{"rules": []} == {"rules":
    []}` is true — a seed that silently wrote nothing would turn the comparison
    into a green test about an empty rulebook. So the floor is a LITERAL and the
    ids are checked against the fixture's rather than counted, for the reason
    `00-HOW-TO-EXECUTE.md` §1.1 gives: a count of five is satisfied by five wrong
    rows. A failure here is reported as a setup ERROR, which names this fixture
    rather than the test.
    """
    engine = seam_engine(migrated_database)
    try:
        written = _seed_the_committed_fixture(engine)
    finally:
        engine.dispose()

    expected = {UUID(str(rule["id"])) for rule in _fixture_document()["rules"]}
    assert len(written) == SEEDED_RULES, (
        f"the seed wrote {len(written)} rows, not {SEEDED_RULES}. The test this "
        f"feeds compares the response against the committed fixture, and two empty "
        f"documents are equal."
    )
    assert written == expected, (
        f"the seed landed {sorted(written)}, which are not the fixture's ids "
        f"{sorted(expected)}. The comparison is against a document built from those "
        f"exact rows, so a seed writing others would fail on the values rather than "
        f"on the shape."
    )
    return written


# --- the route, against a real database -------------------------------------


def test_the_route_answers_the_committed_fixture_byte_for_byte(
    app_dsn: str,
    seeded_rulebook: set[UUID],
    frozen_clock: FrozenClock,
    id_factory: SequenceIdFactory,
) -> None:
    """🔴 THE HOP `test_rules_contract_parity.py` COULD NOT TAKE.

    That module drives `RuleRepository.list_all` -> `from_rows` ->
    `model_dump_json` and compares the bytes; it says so, and it says why that is
    one hop short — the route did not exist. Everything between `from_rows` and
    the socket is asserted only here: FastAPI's `response_model` round trip, its
    own JSON encoder, and the fact that the sessionmaker the handler reaches for
    is the one the lifespan built from `app_database_url`.

    The comparison is on the PARSED documents rather than on the bytes, and the
    key ORDER is asserted separately because `==` on two dicts does not see it.
    Order matters to nobody's parser and matters to a reader diffing a captured
    response, which is what the fixture is for.

    THIS IS ALSO THIS FILE'S ONLY POSITIVE CONTROL. The two failure tests below
    would both pass against a route that raised unconditionally; this is the one
    that would not, and it is the reason they mean anything.

    🔴 AND IT IS THE ONLY PLACE IN THE REPOSITORY WHERE `database_answers: True`
    IS ASSERTED. It was asserted NOWHERE, which made every readiness assertion in
    this file a denial — `False` for a dead port, ABSENT for no DSN — and
    `00-HOW-TO-EXECUTE.md` §1.1 is about exactly that suite shape. MEASURED:
    `return False` as the first statement of `lifespan.probe_database` left the
    whole suite at **243 passed**, i.e. a healthy deployment reporting `/ready`
    503 forever, the platform draining every replica of a working service, and
    nothing anywhere noticing. The assertion below is the control, and it is an
    EXACT dict rather than a subset — a subset check is how a key goes missing
    without a failure.

    It is asserted HERE rather than in a test of its own because this is the one
    place in the suite that already holds a healthy database AND a live app, and
    a second one would be a second container's worth of setup to say the same
    thing.

    NO HEADER, NO COOKIE, NO PRINCIPAL — `client.get(RULES_PATH)` and nothing
    else. `settings.mock_auth_enabled` is `False`. A 200 here is a 200 for a
    caller who presented nothing, which is the endpoint's whole premise.
    """
    app = _app(app_dsn, frozen_clock, id_factory)
    with TestClient(app) as client:
        response = client.get(RULES_PATH)
        readiness = client.get("/ready")

    # The positive control, first, because if the probe is broken the response
    # below is the less interesting failure.
    assert readiness.status_code == 200, readiness.text
    assert readiness.json()["checks"] == {"startup_complete": True, DATABASE_CHECK: True}, (
        "a healthy database must make the database readiness check TRUE. Without "
        "this assertion every DATABASE_CHECK claim in this file is a denial, and a "
        "probe hardcoded to fail scores full marks on all of them."
    )

    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("application/json")

    assert json.loads(response.content) == json.loads(_fixture_text()), (
        "the response the route serves is not the committed fixture. A lost "
        "`order_by`, a `created_at` reaching the wire, an unexpected enum spelling "
        "or a `response_model` that excluded unset keys all land here."
    )

    # The floor and the key ORDER, which the comparison above cannot see. Five
    # is a literal rather than `len(expected)`, because a fixture that lost its
    # rows would satisfy an equality between two empty documents and this is the
    # assertion that refuses to be satisfied by it.
    served = _DOCUMENT.validate_json(response.content)["rules"]
    expected = _fixture_document()["rules"]
    assert len(served) == SEEDED_RULES
    assert [list(rule) for rule in served] == [list(rule) for rule in expected], (
        "the response's keys are in a different order from the committed fixture's"
    )


def test_a_role_that_may_not_read_rules_is_a_permanent_fault_not_a_retryable_one(
    roles_applied: str,
    migrated_database: str,
    worker_role: str,
    role_passwords: Mapping[str, str],
    role_dsn: Callable[[str, str, str], str],
    frozen_clock: FrozenClock,
    id_factory: SequenceIdFactory,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """A database that is UP and REFUSES — the failure a dead port cannot produce.

    `titlepipe_worker` is a real, connectable role on the same live
    `postgres:18.4` the test above reads from, and `0003` grants it nothing on
    `rules` (`tests/test_forced_rls_and_grants.py` asserts the grantee set is
    exactly `{titlepipe_owner, titlepipe_app}`). So the server accepts the
    connection, runs the statement, and refuses it — a `ProgrammingError`, raised
    from inside `list_all` rather than from `connect()`.

    NOTHING IS PATCHED AND NOTHING IS MOCKED. That is the point: a
    `monkeypatch`ed `list_all` that raises would exercise the `except` clause and
    prove nothing about whether a real refusal reaches it.

    🔴 THE RAISED CLASS IS NOW ASSERTED, AND IT WAS THE HOLE IN THIS TEST. The
    docstring claimed a live grant refusal and nothing checked it. If
    `titlepipe_worker` lost `LOGIN`, or the password fixture drifted, the
    connection would fail with `OperationalError` instead — the test would still
    have passed and would silently have become a DUPLICATE of the dead-port test,
    leaving the retryable/permanent split with no cover at all. The log line is
    what states which failure happened, and `LogRenderer.JSON` + `capsys` is
    `test_errors.py`'s and `test_logging_pipeline.py`'s idiom for reading it.

    🔴 IT ALSO ANSWERS 500 AND NOT 503, WHICH IS A CHANGE. A missing grant is
    PERMANENT: no amount of retrying fixes it, and `DependencyUnavailableError`
    means "retryable" in `libs/domain/errors.py`'s own words. `rules.py`'s
    `_RETRYABLE` is the split, and this is the test on the permanent side of it;
    `test_a_database_that_cannot_be_reached...` is the test on the other.

    AND IT IS THE LIVE INSTANCE OF THE STARTUP-SNAPSHOT CAVEAT. The probe ran as
    this same role and SUCCEEDED, because `SELECT 1` reads no table — so the whole
    `checks` dict is recorded here rather than only `startup_complete`: a
    deployment can be green on both probes and unable to serve a single request.
    That is `api/routers/health.py`'s `checks` description, measured.
    """
    dsn = role_dsn(migrated_database, worker_role, role_passwords[worker_role])
    settings = CoreApiSettings(
        environment=Environment.TEST,
        app_database_url=SecretStr(dsn),
        log_renderer=LogRenderer.JSON,
    )
    app = create_app(settings, clock=frozen_clock, id_factory=id_factory)

    with TestClient(app, raise_server_exceptions=False) as client:
        capsys.readouterr()  # discard startup, so what follows is one request's
        response = client.get(RULES_PATH)
        emitted = capsys.readouterr().out
        readiness = client.get("/ready")

    # Permanent, so it does NOT invite a retry.
    assert response.status_code == 500, response.text
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert response.json()["error"]["code"] != DEPENDENCY_UNAVAILABLE

    # WHICH failure this was, from the route's own log line. Without this the
    # test cannot tell a live grant refusal from a connection that never opened.
    record = _last_log_record(emitted, "rulebook_read_failed")
    assert record["error_name"] == "ProgrammingError", (
        f"this test exists to drive a live PostgreSQL statement refusal, and the "
        f"route reported {record['error_name']!r} instead. An OperationalError here "
        f"means the connection never opened — check that {worker_role} still has "
        f"LOGIN — and this test has become a duplicate of the dead-port one."
    )
    assert record["retryable"] is False

    # Green on BOTH probes while every product request fails. `SELECT 1` reads no
    # table, so the role's missing grant is invisible to the probe by design —
    # `db/health.py` argues why a probe that read `rules` would be worse — and
    # the consequence is recorded here rather than left to a docstring.
    assert readiness.status_code == 200
    assert readiness.json()["checks"] == {"startup_complete": True, DATABASE_CHECK: True}


def test_readiness_does_not_re_probe_after_the_database_goes_away(
    app_dsn: str,
    seeded_rulebook: set[UUID],
    frozen_clock: FrozenClock,
    id_factory: SequenceIdFactory,
) -> None:
    """🔴 THE STARTUP SNAPSHOT, ASSERTED INSTEAD OF MERELY DOCUMENTED.

    `readiness()`'s own docstring says a probe that "reports healthy for a
    dependency it never checks is worse than no probe, because it silently
    converts an outage into a stream of 500s that the platform will not route
    around" — and for every POST-BOOT outage that is exactly what it now does.
    MEASURED against a real `postgres:18.4`, stopping the container after boot:

        BOOT   /ready 200 {'startup_complete': True, 'database_answers': True}
        AFTER  /ready 200 {'startup_complete': True, 'database_answers': True}
        AFTER  /api/rules 503 DEPENDENCY_UNAVAILABLE

    That is a known and stated limitation — closing it needs `readiness()` to
    become `async`, which changes `api/routers/health.py`'s one call — and a
    stated limitation with no test behind it is a sentence, not a decision. This
    is the test.

    HOW THE DATABASE IS TAKEN AWAY, and why not by stopping the container: the
    container is SESSION-scoped and shared with every other database test in the
    suite, and `ALTER ROLE titlepipe_app NOLOGIN` plus terminating its backends
    is cluster state that a failure here would leave behind for later modules.
    Swapping the engine the running service holds for one aimed at a closed port
    reproduces the same thing at the seam that matters — the service's own handle
    on the database no longer works — with no state outside this function. The
    route really does go through `tenant_session` and really does fail.

    The BOOT line is asserted first and is the control: without it, "readiness is
    still True" would be equally satisfied by a probe that never ran.
    """
    app = _app(app_dsn, frozen_clock, id_factory)
    resources = get_resources(app)

    with TestClient(app) as client:
        assert client.get(RULES_PATH).status_code == 200, "the database was not healthy at boot"
        assert client.get("/ready").json()["checks"] == {
            "startup_complete": True,
            DATABASE_CHECK: True,
        }

        healthy = resources.engine
        assert healthy is not None
        dead = make_engine(f"postgresql+psycopg://probe@127.0.0.1:{_closed_loopback_port()}/probe")
        resources.engine = dead
        resources.sessionmaker = make_sessionmaker(dead)
        try:
            after_ready = client.get("/ready")
            after_rules = client.get(RULES_PATH)
        finally:
            # Put the working pair back before the lifespan's `finally` runs, so
            # shutdown disposes the engine it OPENED rather than this stand-in.
            # The stand-in needs no disposal of its own: every connect against a
            # closed port failed, so its pool never held a connection.
            resources.engine = healthy
            resources.sessionmaker = make_sessionmaker(healthy)

    assert after_ready.status_code == 200, (
        "readiness went red, so it re-probed — which would be an IMPROVEMENT on "
        "the documented behaviour, but `health.py`'s schema description and "
        "`lifespan.readiness`'s docstring both tell operators it does not. Change "
        "them together or not at all."
    )
    assert after_ready.json()["checks"] == {"startup_complete": True, DATABASE_CHECK: True}

    # And the half that makes the first half a problem rather than a curiosity.
    _assert_unavailable_envelope(after_rules)


# --- the route, with no database to reach ------------------------------------


def test_a_database_that_cannot_be_reached_answers_the_error_envelope(
    frozen_clock: FrozenClock, id_factory: SequenceIdFactory, capsys: pytest.CaptureFixture[str]
) -> None:
    """A DSN pointing at a closed port: the server is not there at all.

    The sibling of the test above, and neither subsumes the other — which is now
    ASSERTED rather than argued, on both sides. That one must report a
    `ProgrammingError` and answer 500; this one must report an `OperationalError`
    and answer 503, because a server that is down is the case a retry genuinely
    fixes. If the two ever reported the same class, they would be one test with
    two names and `rules.py`'s `_RETRYABLE` split would be uncovered.

    `/ready` is asserted in the same app, because this is the configuration where
    readiness has to say something and the two answers must not disagree: a
    replica that serves 503s while reporting itself ready is one the platform
    keeps sending traffic to.
    """
    dsn = f"postgresql+psycopg://probe@127.0.0.1:{_closed_loopback_port()}/probe"
    settings = CoreApiSettings(
        environment=Environment.TEST,
        app_database_url=SecretStr(dsn),
        log_renderer=LogRenderer.JSON,
    )
    app = create_app(settings, clock=frozen_clock, id_factory=id_factory)

    with TestClient(app) as client:
        capsys.readouterr()
        response = client.get(RULES_PATH)
        emitted = capsys.readouterr().out
        readiness = client.get("/ready")

    _assert_unavailable_envelope(response)

    record = _last_log_record(emitted, "rulebook_read_failed")
    assert record["error_name"] == "OperationalError", (
        f"a closed port must fail at connect(), and the route reported "
        f"{record['error_name']!r}. If this ever matches the grant-refusal test's "
        f"class, the two are one test with two names."
    )
    assert record["retryable"] is True

    assert readiness.status_code == 503
    assert readiness.json()["checks"] == {"startup_complete": True, DATABASE_CHECK: False}


def test_with_no_dsn_the_service_is_ready_and_the_rulebook_is_unavailable(
    frozen_clock: FrozenClock, id_factory: SequenceIdFactory
) -> None:
    """The DB-less local run, which must keep working — and which is why the
    deployed refusal had to be a refusal rather than a red check.

    Unset, the service starts, `/ready` answers 200 carrying NO database key, and
    `GET /api/rules` answers the 503 envelope. That combination is what a
    developer running `TITLEPIPE_ENVIRONMENT=development` alone gets, and what
    `apps/web-v2/e2e-live` and `migration-harness.yml` both depend on.

    🔴 IT USED TO BE WHAT A DEPLOYED ENVIRONMENT GOT TOO, AND THAT WAS THE
    DEFECT. The failure was invisible on both surfaces an operator watches —
    `/health` green, `/ready` green because a missing DSN is NO check rather than
    a failed one — while every product request answered a retryable 503 that
    could never succeed. `settings.py` now refuses to construct a deployed
    configuration without a DSN, and
    `test_settings.py::test_production_refuses_each_unsafe_knob` covers that
    side. This test is the other side of the same ruling: `Environment.TEST` is
    not deployed, so the permissive path is unchanged, and if somebody ever makes
    the refusal unconditional this is what fails.

    It is also what fails the day the database check becomes unconditional:
    `checks` would carry `database_answers: False` here and `/ready` would be 503
    for every local run.
    """
    app = _app(None, frozen_clock, id_factory)

    with TestClient(app) as client:
        readiness = client.get("/ready")
        response = client.get(RULES_PATH)

    assert readiness.status_code == 200
    assert readiness.json()["checks"] == {"startup_complete": True}
    assert DATABASE_CHECK not in readiness.json()["checks"]

    _assert_unavailable_envelope(response)


def test_nothing_is_opened_before_the_lifespan_runs_and_all_of_it_is_released_after(
    frozen_clock: FrozenClock, id_factory: SequenceIdFactory
) -> None:
    """`lifespan.py`'s opening rule, applied to the first resource that can break it.

    A DSN is configured, so this app WILL build an engine — and it must not have
    one until the lifespan runs. `create_app` happens in a test collector, in a
    CLI that only wants the OpenAPI schema, and in whatever process imports the
    module; an engine built there holds the app role's credential in a process
    that has no business with it.

    The release half is asserted on the same object, because a `ServiceResources`
    outlives its lifespan in this suite and a sessionmaker left behind over a
    disposed pool is a handler that fails at the first statement rather than at
    the missing dependency.

    The port is closed, so the startup probe fails — which is deliberate. It
    proves the engine is built and released on the UNHAPPY path too; a
    `finally` that only ran after a successful probe would leak a pool for every
    replica that started while the database was down.
    """
    dsn = f"postgresql+psycopg://probe@127.0.0.1:{_closed_loopback_port()}/probe"
    app = _app(dsn, frozen_clock, id_factory)
    resources = get_resources(app)

    assert resources.engine is None
    assert resources.sessionmaker is None

    with TestClient(app):
        assert resources.engine is not None, "the lifespan did not build an engine"
        assert resources.sessionmaker is not None

    assert resources.engine is None, "the engine outlived the lifespan"
    assert resources.sessionmaker is None
    assert resources.database_answered is False


def _assert_unavailable_envelope(response: Response) -> None:
    """The one shape every failure in this service leaves in, asserted once.

    Extracted because three tests make the identical claim about three different
    causes, and a fourth will. What it must NOT become is a helper that asserts
    only the status: the status is the least specific thing here, and the
    `code`, the correlation id and the absence of internals are what
    `api/errors.py` exists to guarantee.
    """
    assert response.status_code == 503, response.text
    assert response.headers["content-type"].startswith("application/json")

    error = _ENVELOPE.validate_json(response.content)["error"]

    assert set(error) == {"code", "message", "request_id", "details"}
    assert error["code"] == DEPENDENCY_UNAVAILABLE
    assert error["details"] == {}

    # The header and the envelope must agree. A hand-written 503 could carry one
    # or the other; only the real middleware pair produces the same id in both.
    request_id = response.headers["X-Request-ID"]
    assert UUID_OR_SEQUENCE.match(request_id), request_id
    assert error["request_id"] == request_id

    # Not a stack trace, and not a connection string. `handle_domain_error`
    # renders a `DomainError`'s own message, which is client-safe by contract —
    # this is the assertion that notices the day somebody puts the driver's
    # message into it, which quotes the host and can quote the role.
    text_body = response.text
    for leak in ("Traceback", "psycopg", "sqlalchemy", "postgresql", "titlepipe_core"):
        assert leak not in text_body, f"{leak!r} reached the caller: {text_body}"
