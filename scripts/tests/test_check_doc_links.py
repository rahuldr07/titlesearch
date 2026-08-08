"""The doc-link check.

The rot class it exists for: a document cited as reference-of-record by six
files while existing in no commit. A link check that skips link syntax, or
passes on a missing target, recreates exactly that.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from check_doc_links import broken_links, main


def test_a_missing_relative_target_is_reported(tmp_path: Path) -> None:
    doc = tmp_path / "a.md"
    doc.write_text("see [the plan](missing/plan.md) for detail")
    assert broken_links(doc) == ["missing/plan.md"]


def test_an_existing_target_with_a_fragment_passes(tmp_path: Path) -> None:
    (tmp_path / "b.md").write_text("# heading")
    doc = tmp_path / "a.md"
    doc.write_text("see [b](b.md#heading)")
    assert broken_links(doc) == []


def test_external_and_anchor_links_are_out_of_scope(tmp_path: Path) -> None:
    doc = tmp_path / "a.md"
    doc.write_text("[web](https://example.com/x.md) [mail](mailto:a@b.c) [self](#section)")
    assert broken_links(doc) == []


def test_prose_mentions_are_not_links(tmp_path: Path) -> None:
    doc = tmp_path / "a.md"
    doc.write_text("`docs/spec.md` is cited in prose and is INDEX.md's problem")
    assert broken_links(doc) == []


def test_main_reports_and_fails_on_a_broken_link(tmp_path: Path, capsys) -> None:  # type: ignore[no-untyped-def]  # rules-allow(no-any): pytest capsys fixture type is pytest-internal
    doc = tmp_path / "a.md"
    doc.write_text("[gone](gone.md)")
    assert main([str(doc)]) == 1
    assert "gone.md" in capsys.readouterr().out


def test_main_passes_on_clean_files_and_ignores_non_markdown(tmp_path: Path) -> None:
    doc = tmp_path / "a.md"
    doc.write_text("no links here")
    assert main([str(doc), str(tmp_path / "not-checked.py")]) == 0


def test_every_tracked_markdown_link_resolves() -> None:
    """The repository's own docs are the live fixture."""
    repo = Path(__file__).resolve().parent.parent.parent
    vendored = {"node_modules", ".git", ".venv", "dist"}
    tracked = [p for p in repo.rglob("*.md") if not vendored & set(p.parts)]
    assert tracked, "repository markdown not found — wrong root?"
    failures = {
        p.relative_to(repo).as_posix(): broken for p in tracked if (broken := broken_links(p))
    }
    assert failures == {}
