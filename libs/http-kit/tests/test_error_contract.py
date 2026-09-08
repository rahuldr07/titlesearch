"""The contract half, asserted where it now lives.

Both services already exercise these behaviours end-to-end through their apps
(core-api's test_errors.py, blind-svc's test_foundation.py). These tests are
narrower on purpose: they pin the library's own answers so a regression here
fails in this project's suite first, not two projects downstream.
"""

from __future__ import annotations

from titlepipe_domain import (
    DependencyUnavailableError,
    DomainError,
    RefusalError,
)
from titlepipe_http_kit.error_contract import (
    DOMAIN_ERROR_STATUS,
    GENERIC_HTTP_MESSAGE,
    UNMAPPED_STATUS,
    mapped_status_for,
    publishable_detail,
    sanitise_validation_errors,
    status_for,
)


class _UnregisteredError(DomainError):
    pass


class _RefusalSubclass(RefusalError):
    pass


def test_a_registered_error_maps_to_its_status() -> None:
    error = DependencyUnavailableError("capture store unreachable")
    assert mapped_status_for(error) == DOMAIN_ERROR_STATUS[DependencyUnavailableError] == 503
    assert status_for(error) == 503


def test_a_subclass_maps_through_the_mro_without_registration() -> None:
    error = _RefusalSubclass("needs a rule")
    assert mapped_status_for(error) == DOMAIN_ERROR_STATUS[RefusalError] == 422


def test_an_unregistered_error_is_none_then_500() -> None:
    """The `None`/`UNMAPPED_STATUS` split is the fix for the defect this
    package's docstring recounts; both halves are pinned."""
    error = _UnregisteredError("no mapping")
    assert mapped_status_for(error) is None
    assert status_for(error) == UNMAPPED_STATUS


def test_sanitise_keeps_only_type_and_loc() -> None:
    raw: list[dict[str, object]] = [
        {
            "type": "string_pattern_mismatch",
            "loc": ("body", "grantor", 0),
            "msg": "grantor must be uppercase, got 'Jane Roe'",
            "input": "Jane Roe",
            "ctx": {"pattern": "^[A-Z ]+$"},
        }
    ]
    assert sanitise_validation_errors(raw) == [
        {"type": "string_pattern_mismatch", "loc": ["body", "grantor", "0"]}
    ]


def test_sanitise_tolerates_a_missing_loc() -> None:
    assert sanitise_validation_errors([{"type": "missing"}]) == [{"type": "missing"}]


def test_an_authored_detail_is_redacted_only_when_deployed() -> None:
    authored = "order 41c9 was sealed for a different typist"
    assert publishable_detail(authored, status=409, deployed=True) == GENERIC_HTTP_MESSAGE
    assert publishable_detail(authored, status=409, deployed=False) == authored


def test_the_protocols_own_phrase_is_published_even_deployed() -> None:
    assert publishable_detail("Not Found", status=404, deployed=True) == "Not Found"


def test_a_non_string_or_empty_detail_is_the_generic_sentence() -> None:
    assert publishable_detail(None, status=404, deployed=False) == GENERIC_HTTP_MESSAGE
    assert publishable_detail("", status=404, deployed=False) == GENERIC_HTTP_MESSAGE
