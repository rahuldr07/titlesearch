"""Typed configuration for the Blind API, validated at startup.

Everything a deployable shares — the environment refusals, the seal-password
rule, the Host/CORS/docs knobs and the input-hiding seal — comes from
`BaseHttpServiceSettings`. What is left here is the two refusals that exist
only in this service:

- **No Core database.** If a Core connection string is supplied to this service
  at all, something has been wired wrong; the process refuses to start rather
  than holding a credential it must never have.
- **No shared object store.** The blind storage credential must point at the
  blind-input location, not at the extraction or reports areas.

Both are checked in EVERY environment, including development, which is why they
are a validator of their own rather than clauses on
`additional_unsafe_for_deployment` — that hook runs only when the environment is
deployed.

🔴 THIS CLASS USED TO BE A PRIVATE COPY OF THE WHOLE MODEL, AND THE COPY WAS
WRONG. It carried `SEAL_PASSWORD_LENGTH = 32` — the Fernet key's decoded BYTE
count, not its 44-character encoded length — plus a 32-character placeholder
that is not urlsafe-base64 at all. core-api found and fixed that identical bug
and `titlepipe_service_kit.settings` records the account; this copy kept it,
because nothing in this service reads `cookie_seal_password` yet, so no test
ever exercised the value. Inheriting is what makes the bug unrepeatable here:
there is no longer a second number to be wrong.

🔴 A FAILED VALIDATION HERE USED TO PRINT THE ENVIRONMENT IT WAS VALIDATING.
pydantic appends `input_value=` to a `ValidationError`: the RAW pre-validation
dict, head-and-tail truncated. `SecretStr` is no defence — the wrapping happens
after validation, and that dict is what arrived before it — and neither is a
careful validator, because the leak is not in any message a validator wrote. A
five-character `cookie_seal_password` tripping the seal check published the app
DSN password sitting beside it in the truncation window:

    input_value={'environment': 'producti...esql://u:PrOdPw123@h/d'}

`create_app` builds settings before `configure_logging`, so that string reaches
stderr as an uncaught traceback with the redaction pipeline not yet running —
`scrub_credentials` matches that DSN exactly and never gets the chance. Both
halves of the answer live in `titlepipe_service_kit.settings_errors`:
`hide_input_in_errors`, now held by `BaseServiceSettings.__pydantic_init
_subclass__` rather than by this file's own config, and `redacted_settings_error`
at the `from_environment` boundary.
"""

from __future__ import annotations

from typing import Self

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import SettingsConfigDict

from titlepipe_domain import ServiceName
from titlepipe_service_kit.settings import BaseHttpServiceSettings

# The one storage prefix this service may be pointed at. The others —
# `quarantine`, `validated`, `pages`, `reports`, `temporary` — belong to Core
# and the workers, and they are NOT listed here as a blocklist. A blocklist was,
# and it was never read: the validator below refuses anything that is not this
# exact string, which is strictly stronger and does not need editing when a
# sixth area is added somewhere else in the system.
ALLOWED_STORAGE_PREFIX = "blind-input"


class BlindApiSettings(BaseHttpServiceSettings):
    """Blind API configuration. Instantiating this validates it."""

    model_config = SettingsConfigDict(env_prefix="TITLEPIPE_BLIND_")

    service_name: ServiceName = ServiceName.BLIND_API
    port: int = Field(default=8100, ge=1, le=65535)

    # Isolation. Both must stay empty/blind-scoped; see the validator below.
    core_database_url: SecretStr | None = None
    blind_storage_prefix: str = ALLOWED_STORAGE_PREFIX

    @model_validator(mode="after")
    def _the_blind_boundary_holds_in_every_environment(self) -> Self:
        """Unlike the deployment refusals, this one applies in development too.

        A developer who can reach the Core database from the blind service will
        write code that assumes it, and the isolation is then already lost by
        the time staging refuses. That is why it is a validator rather than an
        `additional_unsafe_for_deployment` clause: the hook is consulted only
        when `environment.is_deployed`.
        """
        violations: list[str] = []
        if self.core_database_url is not None:
            violations.append(
                "core_database_url is set; the blind service must never hold a "
                "Core database credential"
            )
        prefix = self.blind_storage_prefix.strip().strip("/").lower()
        if prefix != ALLOWED_STORAGE_PREFIX:
            violations.append(
                f"blind_storage_prefix must be {ALLOWED_STORAGE_PREFIX!r}; got {prefix!r}"
            )
        if violations:
            raise ValueError("blind isolation violated: " + "; ".join(violations))
        return self
