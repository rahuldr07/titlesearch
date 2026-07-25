"""The client-data guard.

A security control with a bypass is worse than none, because it is quoted as
evidence. The bypass below was found in review and is the first case here.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from check_no_client_data import main, violation_for


@pytest.mark.parametrize(
    "path",
    [
        "tests/fixtures/county-search-package.pdf",
        "uploads/report.docx",
        "data/titlepipe.seed",
        "services/core-api/golden.sqlite",
        "docs/scan.tiff",
        "anywhere/at/all/package.pdf",
    ],
)
def test_client_data_is_refused(path: str) -> None:
    assert violation_for(Path(path)) is not None


@pytest.mark.parametrize(
    "path",
    [
        "docs/page-0007.jpg",
        "docs/page-0007.jpeg",
        "apps/web/public/scan.png",
        "anywhere/deed.webp",
        "anywhere/deed.heic",
        "packages/mocks/page.png",
        "uploads/page.bmp",
    ],
)
def test_a_rasterised_page_is_refused_like_the_pdf_it_came_from(path: str) -> None:
    """Scanned packages arrive as images, and a page exported on its own is a
    JPEG or a PNG far more often than a TIFF.

    Only `.tif`/`.tiff` were listed originally, so the two commonest formats
    walked through. `check-added-large-files --maxkb=512` does not cover the
    gap either — one scanned page fits inside that comfortably.
    """
    assert violation_for(Path(path)) is not None
    assert main([path]) == 1


@pytest.mark.parametrize(
    "path",
    [
        "packages/county-package.pdf",
        "packages/contract/fixtures/order.docx",
        "packages/mocks/seed.sqlite",
    ],
)
def test_the_packages_exemption_does_not_extend_to_client_file_types(path: str) -> None:
    """The bypass found in review.

    `packages/` returned early for the whole subtree before the extension was
    tested, so a PDF there was accepted while the identical file was refused
    anywhere else.
    """
    assert violation_for(Path(path)) is not None
    assert main([path]) == 1


@pytest.mark.parametrize(
    "path",
    [
        "packages/contract/src/index.ts",
        "packages/mocks/src/handlers.ts",
        "packages/ui/tokens.css",
    ],
)
def test_workspace_source_is_still_allowed(path: str) -> None:
    """`packages/` is the pnpm workspace and is tracked on purpose. It only
    collides by name with the old prototype's upload directory."""
    assert violation_for(Path(path)) is None
    assert main([path]) == 0


@pytest.mark.parametrize(
    "path",
    [
        "services/core-api/pyproject.toml",
        "libs/domain/src/titlepipe_domain/errors.py",
        "docs/backend/PLAN.md",
        "infra/compose/compose.yaml",
    ],
)
def test_ordinary_source_is_allowed(path: str) -> None:
    assert violation_for(Path(path)) is None


def test_an_upload_directory_is_refused_whatever_it_holds() -> None:
    assert violation_for(Path("uploads/notes.txt")) is not None
    assert violation_for(Path("services/core-api/inbox/thing.json")) is not None


def test_the_allowlist_requires_an_exact_path() -> None:
    assert violation_for(Path("docs/archive/Title report review tool.zip")) is None
    assert violation_for(Path("docs/archive/other.pdf")) is not None


def test_main_reports_every_violation_not_just_the_first(
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert main(["a/one.pdf", "b/two.docx"]) == 1
    captured = capsys.readouterr().out
    assert "one.pdf" in captured
    assert "two.docx" in captured


def test_a_clean_changeset_passes() -> None:
    assert main(["services/core-api/app.py", "packages/contract/src/index.ts"]) == 0
