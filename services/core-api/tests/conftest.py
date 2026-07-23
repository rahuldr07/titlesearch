"""Shared fixtures.

Every test builds its own app through the factory. There is no module-level app
and no shared mutable state between tests, so a test that changes settings
cannot affect the next one.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from titlepipe_core.app import create_app
from titlepipe_core.settings import CoreApiSettings
from titlepipe_domain import Environment
from titlepipe_test_support import FrozenClock, SequenceIdFactory

DEPLOYED_SEAL_PASSWORD = "a-real-32-character-seal-secret!"
DEPLOYED_BASE_URL = "https://app.titlepipe.example"  # must match allowed_hosts


@pytest.fixture
def frozen_clock() -> FrozenClock:
    return FrozenClock(datetime(2026, 7, 22, 12, 0, tzinfo=UTC))


@pytest.fixture
def id_factory() -> SequenceIdFactory:
    return SequenceIdFactory("req")


@pytest.fixture
def development_settings() -> CoreApiSettings:
    return CoreApiSettings(environment=Environment.TEST)


@pytest.fixture
def production_settings() -> CoreApiSettings:
    """A configuration that actually satisfies the deployed-environment rules."""
    return CoreApiSettings(
        environment=Environment.PRODUCTION,
        host="0.0.0.0",
        debug=False,
        reload=False,
        docs_enabled=False,
        mock_auth_enabled=False,
        redaction_enabled=True,
        cors_allowed_origins=("https://app.titlepipe.example",),
        allowed_hosts=("app.titlepipe.example",),
        cookie_seal_password=SecretStr(DEPLOYED_SEAL_PASSWORD),
    )


@pytest.fixture
def app(
    development_settings: CoreApiSettings,
    frozen_clock: FrozenClock,
    id_factory: SequenceIdFactory,
) -> FastAPI:
    return create_app(development_settings, clock=frozen_clock, id_factory=id_factory)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    """A client that runs the lifespan, as the real server does."""
    with TestClient(app) as test_client:
        yield test_client
