"""Process scaffolding shared by every TitlePipe deployable.

`titlepipe_domain` carries the vocabulary — what an environment is, what a
service is called, what an error kind means. This package carries the
*scaffolding built on that vocabulary*: the settings model every process
validates at startup, the structured-logging pipeline whose last processor
before the renderer is redaction, and the narrow seams tracing and metrics
attach to.

It exists because the alternative was measured. Before it, `telemetry/
logging.py` was byte-identical in four services (130 lines x 4), the common
settings block was copied four times, and `telemetry/hooks.py` twice. A
redaction ordering fix would have had to land in four files or silently hold in
one.

Like `titlepipe_domain`, this package may not import a web framework — see the
note at the bottom of `pyproject.toml` and `tests/test_import_boundary.py`.
"""

from titlepipe_service_kit.settings import BaseHttpServiceSettings, BaseServiceSettings
from titlepipe_service_kit.settings_errors import (
    SettingsValidationError,
    redacted_settings_error,
)
from titlepipe_service_kit.telemetry.hooks import NullRequestMetrics, RequestMetrics
from titlepipe_service_kit.telemetry.logging import (
    build_redaction_processor,
    configure_logging,
    get_logger,
)

__all__ = [
    "BaseHttpServiceSettings",
    "BaseServiceSettings",
    "NullRequestMetrics",
    "RequestMetrics",
    "SettingsValidationError",
    "build_redaction_processor",
    "configure_logging",
    "get_logger",
    "redacted_settings_error",
]
