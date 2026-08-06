"""Refuse to commit county packages, seed databases or client documents.

`docs/CONTEXT.md` §19 records a bare relative path in the ingest module writing
every uploaded file into the working tree, producing a 644 MB archive of real
search packages containing GLBA NPI.

This is the cheap structural guard. It is deliberately blunt: it refuses the
file *types* that carry client data anywhere in the tree rather than trying to
judge whether a particular PDF is safe.

## Two rules, applied independently

**Extension rule** — a `.pdf`, `.docx`, `.seed`, `.sqlite` and so on is refused
**anywhere**, with no directory exemptions.

**Directory rule** — a path under `uploads/`, `inbox/` or `county-packages/` is
refused whatever it contains.

They are separate because `packages/` needs an exemption from exactly one of
them. It is the pnpm workspace directory holding `contract`, `ui` and `mocks`
source — tracked on purpose — and it collides by name with the old prototype's
upload directory. So `packages/` is exempt from the **directory** rule only.

> Found in review: an earlier version returned early for the whole `packages/`
> tree *before* testing the extension, so `packages/county-package.pdf` was
> accepted while the identical file was refused anywhere else. The exemption is
> now scoped to the one rule that needs it.
"""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

# Extensions that carry client documents or a golden-set database. Refused
# everywhere, including inside exempt directories.
FORBIDDEN_SUFFIXES = frozenset(
    {
        # documents
        ".pdf",
        ".docx",
        ".doc",
        ".rtf",
        # page images. A county package arrives scanned, and a rasterised page
        # is the same NPI as the PDF it came from. `.tif` was covered from the
        # start and the rest were not, which left the most common export format
        # for a single page — a JPEG or a PNG — walking straight through. Size
        # does not help either: `check-added-large-files --maxkb=512` passes a
        # single scanned page comfortably.
        ".tif",
        ".tiff",
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".bmp",
        ".webp",
        ".heic",
        ".heif",
        ".jp2",
        # databases
        ".seed",
        ".sqlite",
        ".sqlite3",
        ".db",
        ".mdb",
        # archives — an archive is a container for all of the above, and the
        # 644 MB incident was exactly a directory of county packages. Review
        # showed `packages/county-client.zip` sailing through while the same
        # PDFs loose on disk were refused.
        ".zip",
        ".7z",
        ".rar",
        ".tar",
        ".gz",
        ".tgz",
        ".bz2",
        ".xz",
        ".zst",
    }
)

# Directory names that hold uploads or county packages by convention.
FORBIDDEN_DIRECTORY_NAMES = frozenset({"uploads", "inbox", "county-packages"})

# Exempt from the DIRECTORY rule only, never from the extension rule.
DIRECTORY_RULE_EXEMPT_PREFIXES = ("packages/",)

# Not source, and not ours to police.
SKIPPED_PREFIXES = ("node_modules/", ".git/")

# Individual paths permitted despite matching.
#
# Pinned by SHA-256, not by path. An allowlisted *path* is a hole: the file at
# it can be replaced with a county package and the guard would wave it through
# on the strength of a decision made about different bytes. The hash means an
# approved archive stays approved and a swapped one is refused.
ALLOWLIST: dict[str, tuple[str, str]] = {
    "docs/archive/Title report review tool.zip": (
        "baf71d954f1a55a1594a008e39b393f4479c9dcb5cb2c654c4d33f01854c6bda",
        "design screens only; inspected and verified to contain no client documents",
    ),
    # UI crops kept as the reference for the two-NA-states rendering and the
    # action panel. Each was opened and read: every value shown resolves to a
    # fixture in packages/mocks/src/data.ts (the plaintiff is the mocks'
    # CREEKBANK RECOVERY SPV LLC), so there is no client data in any of them.
    # Re-inspect before updating a hash — a screenshot of the same screen taken
    # against a real package would look almost identical and would not be.
    "docs/archive/action-panel-after-c.png": (
        "e9108722247bff5e87fdeaed89a2578c344cdc91766c6afa0b8eb0af425f453c",
        "UI crop of the action panel; all values are packages/mocks fixtures",
    ),
    "docs/archive/na-expected-row.png": (
        "498b51e28dae52242158159c8caabb87aa4c7bf867b9628dd61ff79c3285d897",
        "UI crop of an N/A — EXPECTED row; all values are packages/mocks fixtures",
    ),
    "docs/archive/unreadable-row.png": (
        "e3926563e68894eacec750c08cfd4d2c6c9b433f0a25e3507b5a50ff5fbd504e",
        "UI crop of a PRESENT — UNREADABLE row; all values are packages/mocks fixtures",
    ),
    # ---------------------------------------------------------------------
    # Reviewed 2026-08-06. 81 tracked files matched the extension rule; 68 are
    # admitted below and 13 were REFUSED and escalated to the owner rather than
    # admitted (see docs — they are listed in the review note accompanying this
    # change). The 13 are not an oversight: each shows a value that does not
    # resolve to a fixture, and the standard here is admission on evidence, not
    # on the absence of an objection.
    #
    # Every file below was opened and read at full resolution. The bar applied
    # is the one stated above: each value on the screen resolves to a fixture in
    # `packages/mocks/src/data.ts` (Demoville GA / QUENBY / CREEKBANK / the
    # @titlepipe.internal staff), or the screen carries no property, party or
    # recorded-instrument data at all. Screens that instead render the design
    # export's Arizona universe — the ESTRADA parties, the Maricopa recording
    # stamp, the Mesa/Tucson/Flagstaff addresses `data.ts:51-53` declines to
    # adopt as synthetic — were refused, not admitted.
    #
    # `shots-final/` and `shots-w4/` hold 28 byte-identical pairs; both paths
    # are pinned because the hash, not the path, is what admits a file.
    #
    # Re-inspect before updating a hash — a screenshot of the same screen taken
    # against a real package would look almost identical and would not be.
    # ---------------------------------------------------------------------
    "docs/claude rule book/2_Golden_Rules.docx": (
        "b8e86d50336d73920bcfe46da1f68d3aaada5dce1437f9d65a2f030dd688af2b",
        "rulebook rules text only; read in full — no party, property, parcel, amount or recording detail, and no comments/notes/author metadata",
    ),
    "docs/claude rule book/3_Typed_Report_Template.docx": (
        "2b3c43d4e84bf5826cd82b2333456edfd867fe8e801c68c1c26779e9198e6641",
        "blank typed-report template; read in full — every field is an empty label, no values of any kind",
    ),
    "shots-final/app-audit.png": (
        "21b5f7f62704c396bccdf089aab12eb746b8e50290eb50a9511c7759ff9d7974",
        "app screenshot of the append-only audit record; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-final/app-clients.png": (
        "105d794d72e89b61a7bb84b04570980a666cae2f5da2ba38091d8d8d323e8730",
        "app screenshot of client settings & overrides; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-final/app-completeness.png": (
        "3c37c80d6b458debec471eefda7f8222cb7284b935f72adb69572e44d4126f3e",
        "app screenshot of the completeness gate; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-final/app-delivered.png": (
        "7eb7361fdeb2e8d33b932a3b226533735b66c6383b647cd0ec8d0a25cdcf80df",
        "app screenshot of the delivered/finalized screen; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-final/app-escalation.png": (
        "a1930361d45ab1951a2272595d631dbeeb363b5d13a4ded65019863275c23332",
        "app screenshot of the escalation inbox; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-final/app-gallery.png": (
        "575baf0a654899279bf057b54eef80155b04e4d75acbcb5f67d58ced34a361a2",
        "app screenshot of the states catalogue; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-final/app-overview.png": (
        "04b643d81ce636f84a4c32aef606248501149d056904c18496b46fc56a5941f4",
        "app screenshot of the pipeline board; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-final/app-people.png": (
        "c3a7757d64defc0d72cb3fffac9712bc4e9174aac775d561740537a21f621f6d",
        "app screenshot of the org/people admin; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-final/app-processing.png": (
        "881957a92dd7b64b6cae4a4957a1520f4456a2bfb958fde47a0bb099ebbe376f",
        "app screenshot of the pipeline progress screen; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-final/app-products.png": (
        "f8555d57e6fffb5645bf014da7c99f1e72a4ccf820d90a01794c5bf1234e4efa",
        "app screenshot of products & sign-off config; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-final/app-profile.png": (
        "2eeaf0474755c21ac2e7cfdfa91956d0f4355791cec26ca4f5de45f524a22c7b",
        "app screenshot of the account profile; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-final/app-questions.png": (
        "f0d520f2047e329ab37e6a82ea607e7313bc8eea5a68054fc9342ed4227c3e68",
        "app screenshot of the intake sign-off questions; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-final/app-queue.png": (
        "8cc60be46f7834a331d8deedf55eab452d76e0597d53a8d59787a1134f80e5a1",
        "app screenshot of the reviewer queue; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-final/app-review.png": (
        "002e9600809dc0a5a509c93d61422169baca8b2fe014b53e918294ab66cf639a",
        "app screenshot of the review screen; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-final/app-rulebook.png": (
        "912a0201c4ceffc9a1d84f6034f7bca40592bd464aa9db081bf59aa6f00fc7af",
        "app screenshot of the extraction-rules admin; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-final/app-session.png": (
        "1325f7820f0693efde4aa5a21fbde33b6796bd0a08e0b1ec16cb9355361cb2fc",
        "app screenshot of the session-expired screen; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-final/app-signin.png": (
        "576f2ad5fee8c982b50ba3cb72167b9b4d8258a50ca92fb1d77c4ac934fb5114",
        "app screenshot of the sign-in screen; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-final/app-upload.png": (
        "a599cb157084b1900d4a57e8c182a6432016212ceacdc2032044027d0bf07e83",
        "app screenshot of the upload screen; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-final/design-audit.png": (
        "b0b5e357ceb39665546ed0fb19be193c423066409dd9f1136ebf5d3358c54150",
        "design-export screenshot of the append-only audit record; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-final/design-clients.png": (
        "7b264a40f5371dd369cda1defc43194ac4982884a63a9d48f94c0ee8769bd500",
        "design-export screenshot of client settings & overrides; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-final/design-completeness.png": (
        "8c6bc7bffa127d54357f1e138683e04e5f2fc2b969909b9ede2b0ded57ca3301",
        "design-export screenshot of the completeness gate; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-final/design-delivered.png": (
        "2236fea4661b1673983e9f6f84140afa4760e0c82f320594162b53a774075a70",
        "design-export screenshot of the delivered/finalized screen; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-final/design-escalation.png": (
        "0312c79ce89e9537caae5a73d060e3ac458c1df7c1344383c1a17f911a4fc9e4",
        "design-export screenshot of the escalation inbox; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-final/design-gallery.png": (
        "4708a9a3202d3b583248f0e234948e29246a41b1bb97694b1335b0506c94f5a5",
        "design-export screenshot of the states catalogue; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-final/design-people.png": (
        "d3517a8a1eaff9386486df784ee95f27961dd00471f0e12d9fb0489cc076c7f6",
        "design-export screenshot of the org/people admin; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-final/design-processing.png": (
        "5e784e1d7d96fa00bf074962038d99d1c5043a7bc4c568a384f2414777cd2291",
        "design-export screenshot of the pipeline progress screen; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-final/design-products.png": (
        "34cbc7e6103c1f987a46c7f6207899f1a70095b4faf667c3e51536d28977ce08",
        "design-export screenshot of products & sign-off config; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-final/design-profile.png": (
        "36507b5174059335f1f757f90bb2a16b80acda525bbd9499209a7154a4062050",
        "design-export screenshot of the account profile; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-final/design-questions.png": (
        "f819f78768607aa557a19ac7d973b94daac8c92580f0e96e7a8f4e861501e40e",
        "design-export screenshot of the intake sign-off questions; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-final/design-rulebook.png": (
        "daf7a688ebc95fca57c35260ce75559bd33132a7eb04b22550b261d14dc0269c",
        "design-export screenshot of the extraction-rules admin; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-final/design-session.png": (
        "b250695c89c6545324c53e4c5e996e55f2959ca02561f3c66808182b9057f282",
        "design-export screenshot of the session-expired screen; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-final/design-signin.png": (
        "8bdfd0e89b1621abecf440f4602b190df1293ac9769fb08805a98bd9bc482012",
        "design-export screenshot of the sign-in screen; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-final/design-upload.png": (
        "9138a44713a385f0104da792420a20aa973ba6cc60894cc9383528a8358204a8",
        "design-export screenshot of the upload screen; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-w4/app-audit.png": (
        "21b5f7f62704c396bccdf089aab12eb746b8e50290eb50a9511c7759ff9d7974",
        "app screenshot of the append-only audit record; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-w4/app-clients.png": (
        "105d794d72e89b61a7bb84b04570980a666cae2f5da2ba38091d8d8d323e8730",
        "app screenshot of client settings & overrides; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-w4/app-completeness.png": (
        "15f3ebdbe45be83ed6e7e50cd06d75b58cc61f03d0425152df7e48793030c5df",
        "app screenshot of the completeness gate; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-w4/app-escalation.png": (
        "a1930361d45ab1951a2272595d631dbeeb363b5d13a4ded65019863275c23332",
        "app screenshot of the escalation inbox; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-w4/app-gallery.png": (
        "575baf0a654899279bf057b54eef80155b04e4d75acbcb5f67d58ced34a361a2",
        "app screenshot of the states catalogue; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-w4/app-overview.png": (
        "04b643d81ce636f84a4c32aef606248501149d056904c18496b46fc56a5941f4",
        "app screenshot of the pipeline board; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-w4/app-people.png": (
        "c3a7757d64defc0d72cb3fffac9712bc4e9174aac775d561740537a21f621f6d",
        "app screenshot of the org/people admin; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-w4/app-processing.png": (
        "8bc86d38588d21b522a56868869bbb506a3c6aae0404cce58a3d256a25c5b25a",
        "app screenshot of the pipeline progress screen; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-w4/app-products.png": (
        "f8555d57e6fffb5645bf014da7c99f1e72a4ccf820d90a01794c5bf1234e4efa",
        "app screenshot of products & sign-off config; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-w4/app-profile.png": (
        "2eeaf0474755c21ac2e7cfdfa91956d0f4355791cec26ca4f5de45f524a22c7b",
        "app screenshot of the account profile; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-w4/app-questions.png": (
        "f0d520f2047e329ab37e6a82ea607e7313bc8eea5a68054fc9342ed4227c3e68",
        "app screenshot of the intake sign-off questions; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-w4/app-queue.png": (
        "112f2806150b418b09d26d62f80330e71645fde0e9c15c159240e9d3762d8814",
        "app screenshot of the reviewer queue; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-w4/app-review-bottom.png": (
        "c61b82248dafa3a5a6ba57c1fe707ea07110712cfe8d68f25df45122a2bd56b8",
        "app screenshot of the review screen, scrolled; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-w4/app-review.png": (
        "6779cf870a9fa551239bf80b0d29647795ea906c828111dd25f01739e0823150",
        "app screenshot of the review screen; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-w4/app-rulebook.png": (
        "0be7c9beaf1f040855c52619205a4f6e26dad25fd8cc092e0953b61f4fe268d0",
        "app screenshot of the extraction-rules admin; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-w4/app-session.png": (
        "1325f7820f0693efde4aa5a21fbde33b6796bd0a08e0b1ec16cb9355361cb2fc",
        "app screenshot of the session-expired screen; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-w4/app-signin.png": (
        "576f2ad5fee8c982b50ba3cb72167b9b4d8258a50ca92fb1d77c4ac934fb5114",
        "app screenshot of the sign-in screen; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-w4/app-upload.png": (
        "2019758a960dd49fa1647bf6e2a650469f6c58937209153b8d0d1e35400eb093",
        "app screenshot of the upload screen; every value shown resolves to a packages/mocks fixture",
    ),
    "shots-w4/design-audit.png": (
        "b0b5e357ceb39665546ed0fb19be193c423066409dd9f1136ebf5d3358c54150",
        "design-export screenshot of the append-only audit record; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-w4/design-clients.png": (
        "7b264a40f5371dd369cda1defc43194ac4982884a63a9d48f94c0ee8769bd500",
        "design-export screenshot of client settings & overrides; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-w4/design-completeness.png": (
        "8c6bc7bffa127d54357f1e138683e04e5f2fc2b969909b9ede2b0ded57ca3301",
        "design-export screenshot of the completeness gate; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-w4/design-delivered.png": (
        "2236fea4661b1673983e9f6f84140afa4760e0c82f320594162b53a774075a70",
        "design-export screenshot of the delivered/finalized screen; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-w4/design-escalation.png": (
        "0312c79ce89e9537caae5a73d060e3ac458c1df7c1344383c1a17f911a4fc9e4",
        "design-export screenshot of the escalation inbox; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-w4/design-gallery.png": (
        "4708a9a3202d3b583248f0e234948e29246a41b1bb97694b1335b0506c94f5a5",
        "design-export screenshot of the states catalogue; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-w4/design-people.png": (
        "d3517a8a1eaff9386486df784ee95f27961dd00471f0e12d9fb0489cc076c7f6",
        "design-export screenshot of the org/people admin; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-w4/design-processing.png": (
        "cba0f7b3c87d817ab8ffa30fc55d78ad531ef3ad84045cec8ed6ddee5a27276b",
        "design-export screenshot of the pipeline progress screen; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-w4/design-products.png": (
        "34cbc7e6103c1f987a46c7f6207899f1a70095b4faf667c3e51536d28977ce08",
        "design-export screenshot of products & sign-off config; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-w4/design-profile.png": (
        "36507b5174059335f1f757f90bb2a16b80acda525bbd9499209a7154a4062050",
        "design-export screenshot of the account profile; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-w4/design-questions.png": (
        "f819f78768607aa557a19ac7d973b94daac8c92580f0e96e7a8f4e861501e40e",
        "design-export screenshot of the intake sign-off questions; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-w4/design-rulebook.png": (
        "daf7a688ebc95fca57c35260ce75559bd33132a7eb04b22550b261d14dc0269c",
        "design-export screenshot of the extraction-rules admin; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-w4/design-session.png": (
        "b250695c89c6545324c53e4c5e996e55f2959ca02561f3c66808182b9057f282",
        "design-export screenshot of the session-expired screen; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-w4/design-signin.png": (
        "8bdfd0e89b1621abecf440f4602b190df1293ac9769fb08805a98bd9bc482012",
        "design-export screenshot of the sign-in screen; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
    "shots-w4/design-upload.png": (
        "9138a44713a385f0104da792420a20aa973ba6cc60894cc9383528a8358204a8",
        "design-export screenshot of the upload screen; chrome and rule/admin copy only — no property, party or recorded-instrument data",
    ),
}


def violation_for(path: Path) -> str | None:
    """The reason this path is refused, or `None` if it is acceptable."""
    relative = path.as_posix()

    if relative in ALLOWLIST:
        expected, reason = ALLOWLIST[relative]
        if not path.exists():
            return None  # deleted or renamed; nothing to admit
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != expected:
            return (
                f"allowlisted as {reason!r}, but the content has changed "
                f"(sha256 {actual[:16]}… != {expected[:16]}…). Re-inspect it and "
                "update the hash deliberately."
            )
        return None
    if relative.startswith(SKIPPED_PREFIXES):
        return None

    # Extension rule — no exemptions.
    if path.suffix.lower() in FORBIDDEN_SUFFIXES:
        return f"{path.suffix} files may contain client documents or golden data"

    # Directory rule — `packages/` is the pnpm workspace, not county packages.
    if relative.startswith(DIRECTORY_RULE_EXEMPT_PREFIXES):
        return None
    conflicting = {part.lower() for part in path.parts} & FORBIDDEN_DIRECTORY_NAMES
    if conflicting:
        return f"{sorted(conflicting)[0]}/ holds uploads and must never be committed"

    return None


def main(argv: list[str]) -> int:
    violations = [
        (Path(argument).as_posix(), reason)
        for argument in argv
        if (reason := violation_for(Path(argument))) is not None
    ]

    if not violations:
        return 0

    print("Refusing to commit files that may contain client data:\n")
    for relative, reason in violations:
        print(f"  {relative}\n      {reason}")
    print(
        "\nCounty packages, seed databases and client documents never enter VCS.\n"
        "Store them at an absolute configured path outside the working tree.\n"
        "If a file is genuinely synthetic and safe, add it to ALLOWLIST in\n"
        "scripts/check_no_client_data.py with a reason."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
