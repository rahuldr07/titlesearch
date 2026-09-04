"""Integration points for tracing and metrics.

OpenTelemetry and Prometheus are not dependencies yet, and domain code must
never import them. These protocols are the seam: a later gate supplies a real
implementation, and nothing above this module changes.

The narrowness is the design. `record_request` takes a bounded set of low
-cardinality values and no free-form attribute bag, because an attribute bag is
how tenant and order identifiers end up in Prometheus labels — a cardinality
explosion and a leak in the same mistake.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class RequestMetrics(Protocol):
    """Records one completed HTTP request.

    Every argument is deliberately low-cardinality. `route` is the templated
    path (`/api/orders/{id}`), never the resolved one, so an order identifier
    cannot become a label value.
    """

    def record_request(
        self, *, method: str, route: str, status_code: int, duration_ms: float
    ) -> None: ...


class NullRequestMetrics:
    """The Gate 1 implementation: correct, and does nothing.

    A no-op rather than an optional dependency means call sites are written and
    exercised now, so wiring a real backend later is a constructor change.
    """

    def record_request(
        self,
        *,
        method: str,  # noqa: ARG002 — signature is the contract; the body is not
        route: str,  # noqa: ARG002
        status_code: int,  # noqa: ARG002
        duration_ms: float,  # noqa: ARG002
    ) -> None:
        return None
