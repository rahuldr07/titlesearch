"""HTTP-layer plumbing shared by the TitlePipe API services.

`titlepipe_service_kit` is scaffolding every deployable runs, and its boundary
test forbids it a web framework so a web server never enters the worker image.
This package is the layer that rule pushed out: code both API services need and
the worker must never load. It MAY import starlette; it may not import fastapi,
a service, or the service kit — `tests/test_import_boundary.py` refuses each of
those statically.

It exists because the alternative was measured. `api/request_context.py` was
byte-identical in both API services (258 lines x 2, md5-confirmed), and the
error contract beneath their envelopes was identical except for one table's
name. The duplication produced a real defect: core-api fixed its
`domain_error_unmapped` condition and blind-svc's untouched copy kept logging a
correctly-mapped 503 as unmapped — silently, because nothing there raised a
registered 5xx yet. See `error_contract.mapped_status_for`.

The envelope SHAPE stays per-service, deliberately: the two services answer
observably different bodies, each pinned by its own tests. This package is
everything underneath the shape.
"""

from titlepipe_http_kit.error_contract import (
    CODE_BAD_REQUEST,
    CODE_INTERNAL_ERROR,
    CODE_METHOD_NOT_ALLOWED,
    CODE_NOT_FOUND,
    CODE_VALIDATION_FAILED,
    DOMAIN_ERROR_STATUS,
    GENERIC_HTTP_MESSAGE,
    GENERIC_INTERNAL_MESSAGE,
    STARLETTE_STATUS_CODES,
    UNMAPPED_STATUS,
    mapped_status_for,
    publishable_detail,
    sanitise_validation_errors,
    status_for,
)
from titlepipe_http_kit.request_context import (
    MAX_INBOUND_REQUEST_ID_LENGTH,
    REQUEST_ID_HEADER,
    RequestContextMiddleware,
    RequestHandler,
    current_request_id,
    request_id_for,
    sanitise_inbound_request_id,
)

__all__ = [
    "CODE_BAD_REQUEST",
    "CODE_INTERNAL_ERROR",
    "CODE_METHOD_NOT_ALLOWED",
    "CODE_NOT_FOUND",
    "CODE_VALIDATION_FAILED",
    "DOMAIN_ERROR_STATUS",
    "GENERIC_HTTP_MESSAGE",
    "GENERIC_INTERNAL_MESSAGE",
    "MAX_INBOUND_REQUEST_ID_LENGTH",
    "REQUEST_ID_HEADER",
    "STARLETTE_STATUS_CODES",
    "UNMAPPED_STATUS",
    "RequestContextMiddleware",
    "RequestHandler",
    "current_request_id",
    "mapped_status_for",
    "publishable_detail",
    "request_id_for",
    "sanitise_inbound_request_id",
    "sanitise_validation_errors",
    "status_for",
]
