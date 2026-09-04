"""Gate one of two over the ERROR wire: does the shape the service emits survive
the browser's own reader?

`contract-fixtures/error-envelope.json` is produced here, off real HTTP responses
from a real app rather than by dumping a Pydantic model — an error body is
composed by a HANDLER, and a model dump would prove the model round-trips while
saying nothing about what leaves `handle_domain_error`. Its pair is
`apps/web/error-contract-parity.test.ts`, which pushes the same committed bytes
through the ACTUAL boundary function (`shared/api.ts::get`) the app calls. Neither
gate is sufficient alone: without this one the fixture rots, without that one the
shape is only ever checked against itself.

🔴 WHAT THIS EXISTS TO CATCH, MEASURED 2026-09-04 AND NOT HYPOTHETICAL. The
envelope used to be `{"error": {"code", "message", "request_id", "details"}}` and
the browser's reader is:

    const message = (body as ErrorBody)?.error;
    if (typeof message === "string" && message.length > 0) return message;
    ...
    return `${response.status} ${response.statusText}`.trim();

An object is not a string, so every sentence this service composed rendered to
the reviewer as "503 Service Unavailable" under `VITE_API_MODE=live` — with no
throw and no console line, which is why a green suite on both sides did not
notice. `packages/mocks` has always sent the flat shape, so mock and service
disagreed about the one member the browser reads and cutover was the moment the
screens went quiet. PLAN.md §4: "not optional API hygiene, it's a rendered-string
contract."

The assertions below therefore pin the PREDICATE (`isinstance(str)` and non-empty)
and not the key layout. A key-set assertion alone would have passed on the broken
shape, because the broken shape also had a key called `error`.
"""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Final

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from titlepipe_core.api.error_envelope import (
    CODE_INTERNAL_ERROR,
    CODE_VALIDATION_FAILED,
    DOMAIN_ERROR_STATUS,
)
from titlepipe_core.app import create_app
from titlepipe_core.settings import CoreApiSettings
from titlepipe_domain import (
    ConflictError,
    DependencyUnavailableError,
    DomainError,
    NotFoundError,
    PermissionDeniedError,
    RefusalError,
    UnauthenticatedError,
    ValidationError,
)
from titlepipe_test_support import FrozenClock, SequenceIdFactory

FIXTURE: Final = Path(__file__).resolve().parents[3] / "contract-fixtures" / "error-envelope.json"

# One raise per registered mapping, in a fixed order so the correlation ids the
# sequence factory hands out are stable bytes. The sentences are the ones a
# caller would actually be given: client-safe prose, no identifier, no NPI.
DOMAIN_CASES: Final[tuple[tuple[str, DomainError], ...]] = (
    ("validation", ValidationError("The submitted order is missing a county.")),
    (
        "refusal",
        RefusalError(
            "Resolution requires an existing or drafted rule.",
            details={"required": "rule_id"},
        ),
    ),
    ("unauthenticated", UnauthenticatedError("Sign in to continue.")),
    ("permission", PermissionDeniedError("This seat cannot countersign its own review.")),
    ("not_found", NotFoundError("No such order.")),
    ("conflict", ConflictError("This field was already confirmed with a different value.")),
    (
        "dependency",
        DependencyUnavailableError("The rulebook is temporarily unavailable."),
    ),
)


class ReasonPayload(BaseModel):
    """Module scope, not function scope: under `from __future__ import annotations`
    a locally-defined model cannot be resolved and FastAPI silently demotes the
    parameter to a query string, which makes a 422 test pass for the wrong reason.
    """

    reason: str


def _fixture_text() -> str:
    """The committed file, read with universal newlines.

    A CRLF checkout would otherwise fail the byte comparison over a line ending
    rather than over a defect.
    """
    return FIXTURE.read_text(encoding="utf-8", newline=None)


def _collect(app: FastAPI, base_url: str) -> list[dict[str, object]]:
    """Drive one app and record what the wire carried, status included.

    `raise_server_exceptions=False` so the unhandled case produces the response a
    caller would receive instead of re-raising into the test — the 500 envelope is
    the thing under test, not the exception that caused it.
    """
    collected: list[dict[str, object]] = []
    with TestClient(app, raise_server_exceptions=False, base_url=base_url) as client:
        for name, _ in DOMAIN_CASES:
            response = client.get(f"/raise/{name}")
            collected.append(
                {"case": name, "status": response.status_code, "body": response.json()}
            )
        missing = client.get("/no-such-route")
        collected.append(
            {"case": "route_missing", "status": missing.status_code, "body": missing.json()}
        )
        invalid = client.post("/needs-reason", json={})
        collected.append(
            {"case": "schema_failure", "status": invalid.status_code, "body": invalid.json()}
        )
        boom = client.get("/boom")
        collected.append({"case": "unhandled", "status": boom.status_code, "body": boom.json()})
    return collected


def _wire_app(settings: CoreApiSettings) -> FastAPI:
    """A real app with one route per failure. The clock and the id sequence are
    the doubles from `conftest`, so the correlation ids in the fixture are the
    predictable `req-00000N` rather than a fresh uuid on every run."""
    app = create_app(
        settings,
        clock=FrozenClock(datetime(2026, 7, 22, 12, 0, tzinfo=UTC)),
        id_factory=SequenceIdFactory("req"),
    )

    # A CLOSURE, not a default argument. `def _raise(err: DomainError = error)`
    # is the obvious spelling and FastAPI reads the default as a request field,
    # failing at route-registration time with "Invalid args for response field"
    # — the parameter has to be invisible to the signature, not merely unused.
    def _route_for(error: DomainError) -> Callable[[], Awaitable[None]]:
        async def _raise() -> None:
            raise error

        return _raise

    for name, error in DOMAIN_CASES:
        app.get(f"/raise/{name}")(_route_for(error))

    @app.post("/needs-reason")
    async def _needs_reason(payload: ReasonPayload) -> dict[str, str]:
        return {"reason": payload.reason}

    @app.get("/boom")
    async def _boom() -> None:
        raise RuntimeError("connection string postgres://user:hunter2@db/titlepipe")

    return app


def _emitted(
    development: CoreApiSettings,
    development_url: str,
    deployed: CoreApiSettings,
    deployed_url: str,
) -> str:
    """The document, both environments, exactly as the fixture stores it.

    BOTH environments, because the one member that differs between them is
    `details` on a 500 — populated locally, empty when deployed — and a fixture
    covering only one of them would let the other drift into leaking a driver
    message without any gate noticing.

    `indent=2` and the trailing newline are FIXTURE formatting, not wire
    formatting; the service emits compact JSON and nothing asserts otherwise.
    """
    document = {
        "development": _collect(_wire_app(development), development_url),
        "deployed": _collect(_wire_app(deployed), deployed_url),
    }
    return json.dumps(document, indent=2, sort_keys=False) + "\n"


class _RecordedExchange(BaseModel):
    """One line of the fixture: the case that was driven and what came back."""

    case: str
    status: int
    body: dict[str, object]


class _FixtureDocument(BaseModel):
    """The fixture's own shape, so reading it is a parse and not a cast.

    Both environments are named members rather than a bag keyed by string. The
    fixture is required to carry both, and a rename or a dropped section is then
    a parse failure naming the missing member instead of a loop that silently
    iterates one section.
    """

    development: list[_RecordedExchange]
    deployed: list[_RecordedExchange]


def _envelopes(document: object) -> list[dict[str, object]]:
    """Every recorded body, both environments, flattened.

    Parsed through a model rather than narrowed with `isinstance`. Both spell
    the same runtime check, but `isinstance(x, dict)` proves only the class:
    pyright infers `dict[Unknown, Unknown]` from it and then reports every
    expression that reads an element — the same wall documented at
    `api/error_envelope.py::sanitise_validation_errors`, where the incoming
    type genuinely was `object` and a suppression was the honest end of it.
    Here the shape is ours and known, so it can be stated instead of asserted,
    and the repository already parses every boundary through a schema.
    """
    parsed = _FixtureDocument.model_validate(document)
    return [entry.body for entry in (*parsed.development, *parsed.deployed)]


def test_the_committed_fixture_is_what_the_service_emits_today(
    development_settings: CoreApiSettings,
    production_settings: CoreApiSettings,
    deployed_base_url: str,
) -> None:
    """The fixture is the artifact the TypeScript gate reads. When this fails the
    handlers moved and the fixture did not — regenerate it deliberately and look
    at the diff, because that diff is the wire change the browser will see."""
    assert _fixture_text() == _emitted(
        development_settings,
        "http://testserver",
        production_settings,
        deployed_base_url,
    )


def test_every_envelope_survives_the_browsers_error_reader() -> None:
    """The contract, stated as the browser states it.

    Not `"error" in body` — the nested shape satisfied that too, and satisfying
    it is exactly how the regression shipped. The predicate is the type and the
    emptiness, because those are what `readError` branches on.
    """
    for body in _envelopes(json.loads(_fixture_text())):
        sentence = body.get("error")
        assert isinstance(sentence, str), (
            f"`error` is {type(sentence).__name__}, not a string: the browser drops it and "
            f"renders the bare status line instead. Body: {body}"
        )
        assert sentence, f"an empty sentence reads as a status line in the browser: {body}"


def test_the_sentence_is_never_a_container() -> None:
    """The specific regression, pinned by name.

    Kept separate from the predicate test above so that a failure says WHICH
    mistake was made: a dict at `error` is the old nested envelope coming back,
    which is a different repair from an empty string.
    """
    for body in _envelopes(json.loads(_fixture_text())):
        assert not isinstance(body.get("error"), dict | list), (
            f"the sentence was nested again — see this module's docstring: {body}"
        )


def test_diagnostics_ride_beside_the_sentence_and_are_not_dropped_to_satisfy_it() -> None:
    """Flattening must not have cost the correlation id.

    `request_id` is the only thing tying a sentence a reviewer quotes back to the
    log line that explains it. `code` is stable where the sentence is prose.
    """
    for body in _envelopes(json.loads(_fixture_text())):
        assert set(body) == {"error", "code", "request_id", "details"}, body
        assert isinstance(body["code"], str), body
        assert body["code"], body
        assert isinstance(body["request_id"], str), body
        assert body["request_id"], body
        assert isinstance(body["details"], dict), body


def test_the_sample_exercises_every_registered_code_and_both_shapes_of_details() -> None:
    """The positive control.

    A document holding one 404 passes every assertion above. `DOMAIN_ERROR_STATUS`
    is the registry, so reading the expected codes OUT of it is what makes a newly
    registered failure that nobody sampled fail here rather than ship unsampled.
    """
    document = json.loads(_fixture_text())
    bodies = _envelopes(document)
    codes = {body["code"] for body in bodies}

    registered = {error_type("").code for error_type in DOMAIN_ERROR_STATUS}
    missing = registered - codes
    assert not missing, f"registered failures never sampled into the fixture: {sorted(missing)}"
    assert {CODE_VALIDATION_FAILED, CODE_INTERNAL_ERROR, "NOT_FOUND"} <= codes

    shapes = {bool(body["details"]) for body in bodies}
    assert shapes == {True, False}, (
        "`details` is seen only one way, so nothing here would notice it being "
        "dropped or being populated where it must stay empty"
    )


def test_the_deployed_500_carries_no_internals_and_the_local_one_does() -> None:
    """The one member that differs by environment, asserted in both directions.

    Asserting only the deployed side would pass on a build that had quietly
    stopped populating it anywhere, which is the "blank 500 wastes an afternoon"
    failure rather than a leak.
    """
    document = json.loads(_fixture_text())
    local = [entry for entry in document["development"] if entry["case"] == "unhandled"]
    remote = [entry for entry in document["deployed"] if entry["case"] == "unhandled"]
    assert len(local) == 1, local
    assert len(remote) == 1, remote

    assert local[0]["body"]["details"]["exception"] == "RuntimeError"
    assert remote[0]["body"]["details"] == {}


def test_no_envelope_leaks_an_internal_to_the_deployed_caller() -> None:
    """The raise in `_wire_app` embeds a DSN with a password on purpose."""
    deployed = json.dumps(json.loads(_fixture_text())["deployed"])
    for leak in ("hunter2", "Traceback", "psycopg", "sqlalchemy", "postgresql", "titlepipe_core"):
        assert leak not in deployed, f"{leak!r} reached a deployed caller: {deployed}"


def test_a_schema_failure_names_the_field_without_echoing_the_value() -> None:
    """`details.errors` is the only structured payload the frontend is given, and
    the allowlist that builds it is what keeps a grantor name out of a 422."""
    document = json.loads(_fixture_text())
    failure = next(entry for entry in document["development"] if entry["case"] == "schema_failure")
    assert failure["status"] == 422
    errors = failure["body"]["details"]["errors"]
    assert errors == [{"type": "missing", "loc": ["body", "reason"]}], errors
