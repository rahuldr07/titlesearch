"""Request correlation."""

from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.responses import StreamingResponse

from titlepipe_core.api.request_context import (
    MAX_INBOUND_REQUEST_ID_LENGTH,
    REQUEST_ID_HEADER,
    current_request_id,
    sanitise_inbound_request_id,
)
from titlepipe_test_support import SequenceIdFactory


def test_a_request_id_is_returned_on_every_response(client: TestClient) -> None:
    response = client.get("/health")
    assert response.headers[REQUEST_ID_HEADER] == "req-000001"


def test_each_request_gets_its_own_id(client: TestClient) -> None:
    first = client.get("/health").headers[REQUEST_ID_HEADER]
    second = client.get("/health").headers[REQUEST_ID_HEADER]
    assert first != second


def test_a_valid_inbound_id_is_propagated(client: TestClient) -> None:
    response = client.get("/health", headers={REQUEST_ID_HEADER: "edge-7f3a2b"})
    assert response.headers[REQUEST_ID_HEADER] == "edge-7f3a2b"


def test_the_id_is_returned_on_an_error_response(client: TestClient) -> None:
    """Correlation matters most when something failed."""
    response = client.get("/does-not-exist")
    assert response.status_code == 404
    assert response.headers[REQUEST_ID_HEADER]
    assert response.json()["error"]["request_id"] == response.headers[REQUEST_ID_HEADER]


@pytest.mark.parametrize(
    "hostile",
    [
        "",
        "   ",
        "has spaces",
        "newline\ninjected",
        "semi;colon",
        'quote"quote',
        "x" * (MAX_INBOUND_REQUEST_ID_LENGTH + 1),
    ],
)
def test_a_hostile_inbound_id_is_rejected(hostile: str) -> None:
    """This value lands in every log line for the request. An unvalidated
    header is log injection and unbounded growth, not untidiness."""
    assert sanitise_inbound_request_id(hostile) is None


def test_a_rejected_inbound_id_still_yields_a_generated_one(client: TestClient) -> None:
    """Rejection is not an error: the caller loses correlation, not the request."""
    response = client.get("/health", headers={REQUEST_ID_HEADER: "not valid at all"})
    assert response.status_code == 200
    assert response.headers[REQUEST_ID_HEADER] == "req-000001"


def test_the_context_is_cleared_after_the_request(client: TestClient) -> None:
    """A recycled task must not inherit the previous request's identity. The
    same discipline carries the tenant context at Gate 2."""
    client.get("/health")
    assert current_request_id() is None


def test_the_context_is_cleared_even_when_the_handler_raises(
    app: FastAPI, id_factory: SequenceIdFactory
) -> None:
    @app.get("/boom")
    async def _boom() -> None:
        raise RuntimeError("upstream exploded")

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/boom")

    assert response.status_code == 500
    assert current_request_id() is None


def test_a_mid_stream_failure_does_not_start_a_second_response(app: FastAPI) -> None:
    """Once the status line is on the wire, no envelope can replace it.

    The middleware catches `Exception` to keep the correlation header and the
    CORS layer around a 500 — but that substitution is only legal *before* the
    response starts. Sending a second `http.response.start` replaces the real
    failure with an ASGI protocol error and drops the connection mid-body, so
    the original exception is neither served nor readable in the log.

    Starlette's own `ServerErrorMiddleware` guards this with a `response_started`
    flag; this middleware replaced it and had to grow the same guard. The shape
    is not hypothetical: page delivery and report download stream.
    """

    @app.get("/stream")
    async def _stream() -> StreamingResponse:
        async def body() -> AsyncGenerator[bytes]:
            yield b"partial"
            raise RuntimeError("failed after the first chunk")

        return StreamingResponse(body(), media_type="text/plain")

    # `raise_server_exceptions=True` is what makes the assertion meaningful:
    # what surfaces must be the handler's own RuntimeError. Before the guard it
    # was `AssertionError: Received multiple "http.response.start" messages` —
    # the protocol error standing where the real cause should be.
    with TestClient(app) as client, pytest.raises(RuntimeError, match="after the first chunk"):
        client.get("/stream")

    # The context is still torn down on the way out, exactly as for a
    # pre-response failure.
    assert current_request_id() is None
