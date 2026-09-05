"""The paged-collection shape every list endpoint takes, and the opaque cursor
that walks it.

`discovery-api-surface.md` §5 measured the surface this replaces: **one endpoint
of seventy is paginated**, it pages by OFFSET, and it ships `page_count` — which
forces a `COUNT(*)` over the filtered set on every request. The other twelve
list-shaped endpoints return an unbounded array, and two of them fail soonest:
`GET /audit` is append-only and global, so it is unbounded by construction, and
`GET /orders/{id}/pages` returns the full OCR text of a county package, 600+
pages of it.

## Cursor and not offset, and this is a correctness argument

Orders arrive continuously and the audit log appends continuously. Under
`LIMIT/OFFSET` over a moving set, a row inserted before the window between two
requests shifts every later row forward: page 2 then re-serves a row page 1
already showed, and the row that moved across the boundary is never served at
all. A reviewer walking a queue silently does one order twice and misses one. A
cursor over `(sort_key, id)` costs the same to build — the same index leads it —
and does not have the failure, because the next page is defined by WHERE the
last one ended rather than by how many rows preceded it.

## The token is opaque, and a malformed one REFUSES

`encode_cursor`/`decode_cursor` round-trip through base64url, which is not
encryption and is not claimed to be: it carries a sort key and a UUID, both of
which the caller already holds, and its purpose is to stop a client CONSTRUCTING
one. A client that built its own cursor would be choosing a scan position, which
is a query the server never validated.

**A token that does not decode raises `ValidationError` and becomes a 422.** The
alternative — treating an unparseable cursor as "start from the beginning" — is
the silent-success failure mode this codebase is named for: the caller asked for
page 9, got page 1, and nothing anywhere said so. `libs/domain/errors.py`'s
`ValidationError` is what `api/errors.py` maps, so the refusal arrives with a
sentence in it.

## `total` is NOT on this envelope, and its absence is the ruling

PLAN.md §4 B: counts are computed over the FULL set, lists over the set the
caller may see, and **the two are allowed to disagree** — the census is not
scoped to what the caller may read and the list is. Riding a `total` on every
page makes them look like one number seen twice and puts a `COUNT(*)` on the hot
path besides. A screen that genuinely shows a total calls the census endpoint for
that collection, which is separately cacheable. `Census` below is the shape it
takes, and its `int | None` is the other half of §4 B: **absence must be
distinguishable from zero**, because a backend that sends `0` for "not computed"
changes what the screen claims to the reviewer.

## Subclasses name their own array

There is no `items` key. `packages/contract` names every collection after its
contents — `{"rules": [...]}`, `endpoints.ts:621` — and PLAN.md §4 records that
the WRAPPER IS THE CONTRACT: a bare array, or a differently-named key, is a
different document and Zod rejects it. So `CursorPage` carries the paging members
and each response subclasses it to declare its own list. That also keeps the
array's ORDER a property of the response type rather than of a generic container,
which §4 C requires: several UI behaviours are literally the arrival order of the
array, not a sort key.
"""

from __future__ import annotations

import base64
import binascii
from typing import Final
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from titlepipe_domain import ValidationError

# The separator inside a decoded token. `\x1f` (ASCII UNIT SEPARATOR) rather than
# `:` or `|`, because a sort key is arbitrary text off a row — an address, a
# client name — and any printable delimiter can occur inside one. A token whose
# key contained the delimiter would split into three parts and decode to the
# wrong position rather than refusing, which is the same silent-wrong-answer this
# module's docstring rejects for the unparseable case.
_SEPARATOR: Final = "\x1f"

# Chosen so a page fits one screen's worth of rows with room to scroll, and
# bounded so a caller cannot ask for the unbounded array this module exists to
# remove. Both are wire contract: a request over the maximum is refused, not
# silently clamped, for the same reason a bad cursor is refused.
DEFAULT_PAGE_SIZE: Final = 50
MAX_PAGE_SIZE: Final = 200


def encode_cursor(sort_key: str, id_: UUID) -> str:
    """Freeze one scan position into a token the caller hands back.

    BOTH members, always. `sort_key` alone is not a position because sort keys
    are not unique — `db/repositories/rules.py` measured what a non-unique order does to a
    response under an `UPDATE` — so a cursor on the key alone re-serves or skips
    the rows that tie on it. `id` is the primary key's last column and is what
    makes the position TOTAL, which is the same argument `RuleRepository.list_all`
    makes for its `ORDER BY`.
    """
    raw = f"{sort_key}{_SEPARATOR}{id_}".encode()
    return base64.urlsafe_b64encode(raw).decode("ascii")


def decode_cursor(token: str) -> tuple[str, UUID]:
    """Read a token back, or REFUSE.

    Every failure below raises the same `ValidationError`, which `api/errors.py`
    maps to 422 with a client-safe sentence. None of them returns a default
    position: an unreadable cursor is a caller error, and answering it with page
    one is how a caller reads the wrong page and is never told.

    The message names no internals. What a caller can do about it is identical in
    all four cases — ask for the collection again without a cursor — and the
    shape of the token they sent is not something the server should teach them to
    forge.
    """
    try:
        raw = base64.urlsafe_b64decode(token.encode("ascii")).decode()
    except (binascii.Error, UnicodeDecodeError, ValueError) as error:
        raise ValidationError("That page cursor is not readable. Reload the list.") from error
    key, separator, tail = raw.partition(_SEPARATOR)
    if not separator:
        raise ValidationError("That page cursor is not readable. Reload the list.")
    try:
        return key, UUID(tail)
    except ValueError as error:
        raise ValidationError("That page cursor is not readable. Reload the list.") from error


class CursorPage(BaseModel):
    """The paging members of every list response. Subclasses add the array.

    `next_cursor` carries NO DEFAULT, for the reason `api/schemas/rules.py` states
    at length about `.nullable()` versus `.optional()`: Zod's `.nullable()`
    requires the key PRESENT and permits `null`, and a Python `= None` makes the
    field optional on input, so one `exclude_none` anywhere on the serialisation
    path drops the key and the browser refuses the whole response.

    `None` means THIS IS THE LAST PAGE, and it is the only thing it means. A
    client that receives a cursor is told there is more; a client that receives
    `null` stops. There is no separate `has_more` boolean, because two members
    that can disagree about the same fact is a bug waiting for the day they do.
    """

    model_config = ConfigDict(extra="forbid")

    next_cursor: str | None = Field(
        description="Opaque token for the next page, or null when this is the last."
    )


class Census(BaseModel):
    """A count over the FULL set, served separately from the list it counts.

    **`count` IS `int | None` AND THE `None` IS LOAD-BEARING.** PLAN.md §4 B:
    "absence must be distinguishable from zero for every optional census member —
    a backend that sends 0 for 'not computed' changes what the screen claims to
    the reviewer." `0` is an answer. `null` is the absence of one, and the screen
    renders them differently on purpose.

    It is also allowed to DISAGREE with the length of the corresponding list, and
    that is not a defect to reconcile: the list is scoped to what the caller may
    see and the census is scoped to the full set. A reviewer who can read four of
    nine orders is correctly shown four rows under a count of nine.

    Subclasses add the members a particular collection censuses. This base exists
    so the `int | None` discipline is inherited rather than re-decided, and
    `tests/test_api_layer_discipline.py` asserts no census member carries a
    default.
    """

    model_config = ConfigDict(extra="forbid")

    count: int | None = Field(
        description="Rows in the full set, or null when the count was not computed."
    )
