"""The blindness boundary.

These are security tests, not UI tests. They assert that the isolation is
structural — unreachable rather than filtered — which is the only form of it
that survives someone later adding a convenient endpoint.

Gate 9 extends this file with network and credential reachability proofs
against a deployed blind service. What is provable at Gate 1 is the package and
configuration boundary, and that is what is asserted here.
"""

from __future__ import annotations

import pkgutil
import sys
from pathlib import Path
from typing import cast

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError

import titlepipe_blind
from titlepipe_blind.settings import ALLOWED_STORAGE_PREFIX, BlindApiSettings
from titlepipe_blind.telemetry.sensitivity import BLIND_SENSITIVE_KEY_PARTS
from titlepipe_domain import Environment
from titlepipe_domain.redaction import REDACTED, is_sensitive_key, redact_mapping


def route_paths(app: FastAPI) -> set[str]:
    """Every product path the application actually serves.

    Read from the generated OpenAPI schema rather than by walking `app.routes`.
    FastAPI 0.139 appends an opaque `_IncludedRouter` for an included router —
    its own `path` is `None` and it exposes no children — so a walk of
    `app.routes` sees only `/docs` and `/openapi.json`, and an assertion built
    on it passes without ever inspecting a product endpoint.
    """
    schema = app.openapi()
    paths = schema.get("paths")
    return set(cast("dict[str, object]", paths)) if isinstance(paths, dict) else set()


# Packages whose presence in this process would mean the boundary is gone.
FORBIDDEN_PACKAGES = frozenset(
    {
        "titlepipe_core",
        "titlepipe_extraction",
        "titlepipe_render",
    }
)


def test_the_blind_package_does_not_import_core_or_the_workers() -> None:
    """Import every module, then inspect `sys.modules` — a lazy import inside a
    function body would survive a static scan of the import blocks."""
    before = set(sys.modules)
    root = Path(titlepipe_blind.__file__).parent
    for module in pkgutil.walk_packages([str(root)], prefix="titlepipe_blind."):
        __import__(module.name)
    leaked = {name.split(".")[0] for name in set(sys.modules) - before} & FORBIDDEN_PACKAGES
    assert not leaked, f"blind service imported {leaked}"


def test_no_forbidden_package_is_even_installed() -> None:
    """Stronger than the import check: the code is not on the path at all, so
    it cannot be reached by a future import either."""
    installed = {module.name for module in pkgutil.iter_modules()}
    assert not (installed & FORBIDDEN_PACKAGES)


def test_a_core_database_credential_is_refused_in_every_environment() -> None:
    """Including development. A developer who can reach the Core database from
    here will write code that assumes it, and the isolation is already lost by
    the time staging refuses."""
    for environment in Environment:
        with pytest.raises(ValidationError, match="never hold a Core database credential"):
            BlindApiSettings(
                environment=environment,
                core_database_url=SecretStr("postgresql://core/titlepipe"),
                host="0.0.0.0",
                docs_enabled=False,
                cors_allowed_origins=("https://capture.titlepipe.example",),
                cookie_seal_password=SecretStr("a-real-32-character-seal-secret!"),
            )


@pytest.mark.parametrize("prefix", ["quarantine", "validated", "pages", "reports", "temporary"])
def test_storage_may_only_point_at_the_blind_input_area(prefix: str) -> None:
    """The blind credential reaches source pages and nothing else — not
    extraction output, not rendered reports."""
    with pytest.raises(ValidationError, match="blind_storage_prefix"):
        BlindApiSettings(environment=Environment.DEVELOPMENT, blind_storage_prefix=prefix)


def test_the_permitted_storage_prefix_is_accepted() -> None:
    assert BlindApiSettings(
        environment=Environment.DEVELOPMENT, blind_storage_prefix=ALLOWED_STORAGE_PREFIX
    ).blind_storage_prefix == (ALLOWED_STORAGE_PREFIX)


@pytest.mark.parametrize(
    "key",
    [
        "engine_id",
        "reading",
        "field_readings",
        "confidence_raw",
        "model_output",
        "extraction_state",
        "auto_confirmed",
        "other_seat_value",
        "seat_a_value",
        "seat_b_value",
        "golden_value",
        "reconciliation_ruling",
    ],
)
def test_model_and_cross_seat_keys_are_redacted_here(key: str) -> None:
    """None of this should exist in this process. If one ever appears in a log
    record it is a boundary failure — redaction keeps it out of the shipper
    while the boundary tests keep it out of the code.

    These extend the shared rules rather than replacing them: `grantor` is
    still redacted here too."""
    assert is_sensitive_key(key, extra_parts=BLIND_SENSITIVE_KEY_PARTS)
    assert redact_mapping({key: "anything"}, extra_parts=BLIND_SENSITIVE_KEY_PARTS) == {
        key: REDACTED
    }
    assert redact_mapping({"grantor": "X"}, extra_parts=BLIND_SENSITIVE_KEY_PARTS) == {
        "grantor": REDACTED
    }


def test_no_product_route_exists_at_this_gate(app: FastAPI) -> None:
    """Platform routes and, in development, the docs routes. No product surface.

    Asserted as "nothing beyond this allowlist" rather than "no `/api` prefix",
    because a capture endpoint added at the root would slip past a prefix check.
    """
    paths = route_paths(app)
    assert paths == {"/health", "/ready"}, f"unexpected routes: {sorted(paths)}"


def test_the_service_identifies_itself_as_the_blind_api(client: TestClient) -> None:
    assert client.get("/health").json()["service"] == "blind-api"
