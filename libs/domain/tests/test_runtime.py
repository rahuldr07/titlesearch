"""The runtime vocabulary the configuration-safety rules are written against."""

from __future__ import annotations

import pytest

from titlepipe_domain import Environment, LogRenderer, ServiceName


@pytest.mark.parametrize(
    ("env", "deployed"),
    [
        (Environment.DEVELOPMENT, False),
        (Environment.TEST, False),
        (Environment.STAGING, True),
        (Environment.PRODUCTION, True),
    ],
)
def test_is_deployed_includes_staging(env: Environment, deployed: bool) -> None:
    """Staging integrates with real WorkOS, R2 and model providers. An unsafe
    knob there is a real exposure, so it carries production's rules."""
    assert env.is_deployed is deployed


def test_environments_parse_from_their_configured_strings() -> None:
    assert Environment("production") is Environment.PRODUCTION
    with pytest.raises(ValueError, match="prod"):
        Environment("prod")


def test_every_deployable_has_a_name() -> None:
    assert {s.value for s in ServiceName} == {
        "core-api",
        "blind-api",
        "extraction-worker",
        "render-worker",
    }


def test_log_renderers() -> None:
    assert {r.value for r in LogRenderer} == {"console", "json"}
