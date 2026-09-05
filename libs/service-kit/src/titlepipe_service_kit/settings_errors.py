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


# What a validation error that belongs to no single field is called. A
# `model_validator(mode="after")` raising `ValueError` reaches pydantic with an
# EMPTY `loc`, so joining it produces the empty string — a name that names
# nothing while looking like it named something. The spelling is the worker
# CLI's, which found this first and had its own copy.
CROSS_FIELD_RULE: Final = "<cross-field rule>"


class SettingsValidationError(ValueError):
    """A settings failure carrying field names and reasons, never the input.

    A `ValueError`, because that is what `pydantic_settings.SettingsError`
    already is and what a caller distinguishing "bad configuration" from
    "broken code" is written against.

    Two views, and callers pick by how much they trust their own validators:

    * `invalid_fields` — the `loc` of each failure, `CROSS_FIELD_RULE` where
      there is none. Derived from the schema, never from a value, so it is safe
      to log anywhere.
    * `problems` — `field: msg`, and `str(self)` is built from these. The `msg`
      half is written by the validator that refused, so it is only as safe as
      that validator: the ones in this package interpolate `len(secret)` and
      never `secret`, but **the worker's two cross-field rules deliberately
      quote the value that failed, and one of those values is a URL that can
      carry credentials in its userinfo**. `services/worker/cli.py` therefore
      logs `invalid_fields` and never the message, and that is not belt-and-
      braces — it is the only correct reading for that service.

    So this class does not claim its message is safe to log. It claims the
    PRE-VALIDATION INPUT is gone from it, which is the leak it was written for;
    what a validator chooses to put in its own message is that validator's
    property, and `invalid_fields` is here so a caller that cannot vouch for
    them has something to report instead.
    """

    def __init__(
        self,
        model_name: str,
        problems: tuple[str, ...],
        invalid_fields: tuple[str, ...],
    ) -> None:
        self.model_name = model_name
        self.problems = problems
        self.invalid_fields = invalid_fields
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
    errors = exc.errors(include_url=False, include_context=False, include_input=False)
    fields = tuple(
        ".".join(str(part) for part in error["loc"]) if error["loc"] else CROSS_FIELD_RULE
        for error in errors
    )
    problems = tuple(
        f"{field}: {error['msg']}" for field, error in zip(fields, errors, strict=True)
    )
    return SettingsValidationError(model_name, problems, fields)
