"""Shared fixtures for the blind service."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from titlepipe_blind.app import create_app
from titlepipe_blind.settings import BlindApiSettings
from titlepipe_domain import Environment
from titlepipe_test_support import FrozenClock, SequenceIdFactory

DEPLOYED_SEAL_PASSWORD = "a-real-32-character-seal-secret!"


@pytest.fixture
def frozen_clock() -> FrozenClock:
    return FrozenClock(datetime(2026, 7, 22, 12, 0, tzinfo=UTC))


@pytest.fixture
def id_factory() -> SequenceIdFactory:
    return SequenceIdFactory("req")


@pytest.fixture
def development_settings() -> BlindApiSettings:
    return BlindApiSettings(environment=Environment.TEST)


@pytest.fixture
def production_settings() -> BlindApiSettings:
    return BlindApiSettings(
        environment=Environment.PRODUCTION,
        host="0.0.0.0",
        docs_enabled=False,
        cors_allowed_origins=("https://capture.titlepipe.example",),
        cookie_seal_password=SecretStr(DEPLOYED_SEAL_PASSWORD),
    )


@pytest.fixture
def app(
    development_settings: BlindApiSettings,
    frozen_clock: FrozenClock,
    id_factory: SequenceIdFactory,
) -> FastAPI:
    return create_app(development_settings, clock=frozen_clock, id_factory=id_factory)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
