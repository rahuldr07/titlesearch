"""Shared runtime vocabulary.

Every deployable needs the same words for *where it is running* and *what it
is*, because the configuration-safety rules are written in terms of them. The
enums live here so the four services cannot drift into disagreeing about what
"staging" means.

The safety *checks* themselves stay in each service's own settings module: the
Core API has public docs and a CORS allowlist to get wrong, and a worker has
neither, so a shared validator would have to be written in terms of knobs that
half the deployables do not have.
"""

from __future__ import annotations

from enum import StrEnum


class Environment(StrEnum):
    """Where the process is running.

    `TEST` is a first-class value rather than an alias for development: test
    configuration may relax things development must not, and conflating the two
    is how a test-only bypass reaches a developer's machine.
    """

    DEVELOPMENT = "development"
    TEST = "test"
    STAGING = "staging"
    PRODUCTION = "production"

    @property
    def is_deployed(self) -> bool:
        """Staging and production hold real or realistic data and are exposed.

        The configuration-safety rules bite here. Staging is included
        deliberately — it integrates with real WorkOS, R2 and providers, so an
        unsafe knob in staging is a real exposure, not a rehearsal.
        """
        return self in (Environment.STAGING, Environment.PRODUCTION)


class ServiceName(StrEnum):
    """The deployable units. One process per container, one name each."""

    CORE_API = "core-api"
    BLIND_API = "blind-api"
    EXTRACTION_WORKER = "extraction-worker"
    RENDER_WORKER = "render-worker"


class LogRenderer(StrEnum):
    """How a log record is rendered.

    Rendering changes; event names and fields do not. A staging incident and a
    local reproduction must be greppable by the same event name.
    """

    CONSOLE = "console"
    JSON = "json"
