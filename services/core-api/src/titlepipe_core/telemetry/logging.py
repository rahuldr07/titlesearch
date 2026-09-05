"""Module path only. The pipeline itself lives in `titlepipe_service_kit`.

This file used to be 130 lines that were byte-identical to the same file in
three other services. It is now a re-export, and it is a re-export rather than a
deletion for one reason: two importers remain under `api/`
(`api/errors.py`, `api/routers/rules.py`) and that directory is being edited by
other work in parallel, so repointing them was out of scope for the extraction.

**This module should not survive.** When `api/` is quiet, change those two
imports to `titlepipe_service_kit.telemetry.logging` and delete this file. It
exists to keep one directory untouched, not because a Core-API-specific log
pipeline is a thing.
"""

from __future__ import annotations

from titlepipe_service_kit.telemetry.logging import (
    build_redaction_processor,
    configure_logging,
    get_logger,
)

__all__ = [
    "build_redaction_processor",
    "configure_logging",
    "get_logger",
]
