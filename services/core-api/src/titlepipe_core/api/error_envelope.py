"""The error envelope: what a failure from this service looks like on the wire.

THE SHAPE, AND ONLY THE SHAPE, LIVES HERE. The code vocabulary, the
domain-failure-to-HTTP mapping and the validation-error scrub moved to
`titlepipe_http_kit.error_contract` when they proved byte-identical with
blind-svc's copies; `api/errors.py` holds the four ASGI handlers that put all of
it on the wire. What this file keeps is the one thing the two services do NOT
share — the body layout — and the measurement that forbids changing it.

Every failure leaves this service in one shape:

    {"error": "...", "code": "...", "request_id": "...", "details": {}}

`error` IS THE SENTENCE, NOT AN OBJECT, AND THE FLATNESS IS THE CONTRACT.
`apps/web/src/shared/api.ts::readError` reads `body.error` and keeps it only
`if (typeof message === "string" && message.length > 0)`; anything else falls
through to `` `${status} ${statusText}` ``. This layer used to nest the sentence
one level down, as `{"error": {"message": ...}}`, which fails that test — so
under `VITE_API_MODE=live` every refusal this service composed reached the
reviewer as "503 Service Unavailable". MEASURED 2026-09-04 by feeding this
module's own `envelope()` output through the browser's predicate. There is no
throw and no console line: the client takes the status-line branch silently,
which is how it survived a green suite on both sides. PLAN.md §4 calls the
string "a rendered-string contract, not optional API hygiene", and
`packages/mocks` has always sent the flat shape — so the mock and the service
disagreed about the one member the browser actually reads, and cutover was the
moment every rendered reason turned into a status line.

The machine holding it is `tests/test_error_contract_parity.py` over the
committed `contract-fixtures/error-envelope.json`, which asserts the browser
predicate itself rather than the key layout.

This flatness is also why the extraction stopped at the shape: blind-svc nests
its body, both layouts are pinned by tests, and a shared model would have had to
change one service's observable responses to exist.

`code`, `request_id` and `details` ride as SIBLINGS of the sentence rather than
being folded into it: dropping them to satisfy the string would trade a silent
render bug for a silent diagnosis one. `code` is stable where the sentence is
prose. Nothing branches on it today — checked across `apps/web/src` and the
Playwright specs, neither reads it — and it stays so that a refusal test can pin
an identity without pinning wording. `request_id` ties the response to the log
line without exposing anything about the tenant or the order.
"""

from __future__ import annotations

from pydantic import BaseModel, Field
from starlette.requests import Request

from titlepipe_http_kit.request_context import current_request_id, request_id_for


class ErrorEnvelope(BaseModel):
    """Every non-2xx response from this service. Flat, and see the module docstring.

    Field ORDER is load-bearing for a human, not for a parser: `error` is
    declared first so `model_dump()` puts the sentence at the top of the body a
    developer reads in a network tab, ahead of the correlation id they only need
    once something is wrong twice.
    """

    error: str = Field(description="Client-safe explanation. Rendered verbatim by the browser.")
    code: str = Field(description="Stable machine-readable identifier.")
    request_id: str | None = Field(default=None, description="Correlation id for this request.")
    # `object`, not `Any`. This is a JSON bag on its way out of the process;
    # nothing reads a value back out of it, and Pydantic validates and
    # serialises the two identically (same JSON schema, same `model_dump`).
    details: dict[str, object] = Field(
        default_factory=dict, description="Safe, structured context. Never NPI."
    )


def envelope(
    *,
    code: str,
    message: str,
    details: dict[str, object] | None = None,
    request: Request | None = None,
) -> dict[str, object]:
    """Build the response body, stamping the correlation id.

    Resolved from the request where one is available. The contextvar alone is
    not enough: the handler for an unhandled exception runs inside Starlette's
    `ServerErrorMiddleware`, which sits *outside* the request-context
    middleware and therefore runs after its reset. Reading only the contextvar
    stamps `null` on precisely the response whose id the caller most needs to
    quote.
    """
    request_id = request_id_for(request) if request is not None else current_request_id()
    return ErrorEnvelope(
        error=message,
        code=code,
        request_id=request_id,
        details=details or {},
    ).model_dump()
