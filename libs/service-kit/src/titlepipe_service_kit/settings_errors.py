"""The boot failure that must not print what it was validating.

pydantic appends `input_value=` to the string form of a `ValidationError`: the
RAW pre-validation dict, head-and-tail truncated. `SecretStr` cannot help there
— the wrapping happens *after* validation and this dict is what arrived
*before* it — and neither can a careful validator, because the leak is not in
any message a validator wrote. A short secret sits inside the truncation
window, so a 5-character `cookie_seal_password` tripping the seal validator
published the app DSN password beside it:

    input_value={'environment': 'producti...esql://u:PrOdPw123@h/d'}

The trigger is any of the dozen deployed-config refusals in `settings.py` —
wildcard `allowed_hosts`, an empty CORS allowlist, docs left enabled — i.e.
exactly what a FIRST deploy hits. And a service factory builds settings before
it configures logging, so the string lands on stderr as an uncaught traceback:
the redaction pipeline that would have scrubbed that DSN is not running yet.

## Two mechanisms, and the independence is the point

1. `hide_input_in_errors` drops the input from every rendering pydantic does,
   on every construction path — including a bare `cls(...)` in a test, which
   never reaches `from_environment`. It lives in `BaseServiceSettings.
   model_config`, sealed there by `__pydantic_init_subclass__`, because it is
   one word to delete.
2. `redacted_settings_error` rebuilds the error from `loc` and `msg` alone at
   the `from_environment` boundary, raised `from None` so no chained original
   travels with it. This covers what (1) does not: `exc.errors()` still carries
   `input` whatever the config says, so anything that formats the error dict
   rather than the error would leak again.

This is a separate module from `settings.py` because that file is at its
400-line cap, and because core-api and blind-svc — which do not yet inherit
`BaseServiceSettings` and carry their own copies of the model — import
`redacted_settings_error` from here without importing the base class.
"""

from __future__ import annotations

from typing import Final

from pydantic import ValidationError

# The `model_config` key holding mechanism 1. Named once so the seal in
# `settings.py` and the tests asserting it cannot drift apart by a typo.
HIDE_INPUT_IN_ERRORS: Final = "hide_input_in_errors"


class SettingsValidationError(ValueError):
    """A settings failure carrying field names and reasons, never values.

    A `ValueError`, because that is what `pydantic_settings.SettingsError`
    already is and what a caller distinguishing "bad configuration" from
    "broken code" is written against.

    `problems` is `loc: msg` per failed field. The `msg` half is written by the
    validator that refused, and **a validator must not interpolate a value into
    it** — the ones here interpolate `len(secret)` and never `secret`, which is
    the convention this class depends on and cannot itself enforce.
    """

    def __init__(self, model_name: str, problems: tuple[str, ...]) -> None:
        self.model_name = model_name
        self.problems = problems
        count = len(problems)
        super().__init__(
            f"{model_name} is misconfigured ({count} "
            f"{'problem' if count == 1 else 'problems'}); "
            f"values are omitted deliberately: " + "; ".join(problems)
        )


def redacted_settings_error(model_name: str, exc: ValidationError) -> SettingsValidationError:
    """Rebuild a `ValidationError` as field names and reasons only.

    `include_input=False` is the load-bearing argument. `include_url` and
    `include_context` are off too — the URL is noise in a boot failure, and
    `ctx` carries the original `ValueError` object for a `value_error`, which
    would put the same message in twice.
    """
    problems = tuple(
        f"{'.'.join(str(part) for part in error['loc']) or model_name}: {error['msg']}"
        for error in exc.errors(include_url=False, include_context=False, include_input=False)
    )
    return SettingsValidationError(model_name, problems)
