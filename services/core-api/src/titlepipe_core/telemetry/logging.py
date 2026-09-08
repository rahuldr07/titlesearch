"""Module path only. The pipeline itself lives in `titlepipe_service_kit`.

This file used to be 130 lines that were byte-identical to the same file in
three other services. It is now a re-export with exactly ONE importer left:
`api/errors.py`, which is mid-extraction into libs/http-kit by parallel work
and is deliberately not edited from outside that work. Every other importer —
five under src, plus `tests/test_logging_pipeline.py` — already imports
`titlepipe_service_kit.telemetry.logging` directly.

**This module should not survive.** The remaining step is one line: repoint
`api/errors.py` and delete this file. That swap rides with the http-kit
integration, not with a drive-by edit here.

An earlier version of this note claimed two importers under `api/` and named
`api/routers/rules.py`, which never imported it — an exit condition that had
inverted rather than drained. If this file still exists and the paragraph above
is stale, recount the importers before believing either.
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
