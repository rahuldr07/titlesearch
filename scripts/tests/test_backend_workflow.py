"""The backend workflow cannot quietly enforce less than this repository does.

A GitHub workflow cannot be executed here, so "CI passed" is not available as
proof. What is available, and is the thing actually worth proving, is that
`.github/workflows/backend.yml` and the gates the repository defines for itself
cannot drift apart without something going red on a developer's machine first.

Every assertion below is **derived** from a second file — `.pre-commit-config.yaml`
for the gate list, the filesystem for the set of Python projects. None of them
compares the workflow against a list written out here. A hardcoded list would be
a constant checked against itself: it passes for as long as nobody updates
either side, which is exactly the window in which drift happens.

Four things are checked:

1. the workflow is valid YAML, and every job in it has steps;
2. every hook in the `repo: local` block of `.pre-commit-config.yaml` is named
   by some step's `run:` — the hooks are how this repository writes down what
   its gates are, so a gate added there and not here is a workflow that enforces
   less than the hooks do;
3. every repository path any `run:` names exists, and every `.py` among them
   compiles — a workflow that invokes a renamed script fails five minutes into
   a pipeline instead of here;
4. the `project` matrix covers exactly the set of directories holding a
   `pyproject.toml`. This is the direction that actually happens: a package is
   added, and nothing lints, type-checks or tests it because nobody remembered
   the matrix.

## On the YAML parser

`scripts/tests` is not a uv project, so this suite runs in whatever environment
`uv run --with pytest python -m pytest -q scripts/tests` builds — pytest and the
standard library, no PyYAML. Rather than skip (a skipped drift test is a drift
test that does not exist), `load_yaml` falls back to a real parser in a throwaway
`uv run --with pyyaml` environment. If neither route is available the tests fail
and say so; they never pass by default.
"""

from __future__ import annotations

import json
import re
import shlex
import shutil
import subprocess
import sys
from functools import cache
from pathlib import Path, PurePosixPath
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
WORKFLOW = REPO_ROOT / ".github" / "workflows" / "backend.yml"
PRE_COMMIT = REPO_ROOT / ".pre-commit-config.yaml"

# The job whose matrix is supposed to enumerate every Python project.
PROJECT_JOB = "project"

# A repository-relative path as it appears inside a shell command: at least one
# `/`, and no `{`, `$`, `:` or quote characters, so a `${{ … }}` expression, a
# `{{.Config.User}}` Go template and a `http://host:port/path` URL are all left
# alone. Candidates are filtered again by first segment below.
PATH_TOKEN = re.compile(r"[A-Za-z0-9_.\-]+(?:/[A-Za-z0-9_.\-]+)+")

# Converts a YAML file to JSON on stdout. Used only when PyYAML is not
# importable in the environment running this suite. A parse failure is written
# to stderr as the parser's own message and nothing else, so the assertion that
# reports it reads like a parse error rather than like a traceback.
_YAML_TO_JSON = "\n".join(
    (
        "import json, pathlib, sys, yaml",
        "text = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')",
        "try:",
        "    document = yaml.safe_load(text)",
        "except yaml.YAMLError as exc:",
        "    sys.stderr.write(str(exc))",
        "    raise SystemExit(1) from None",
        "json.dump(document, sys.stdout)",
    )
)


def rel(path: Path) -> str:
    """The path as this repository refers to it, for failure messages."""
    return path.relative_to(REPO_ROOT).as_posix()


def _load_yaml_without_pyyaml(path: Path) -> Any:
    """Parse `path` in a throwaway environment that does have PyYAML."""
    uv = shutil.which("uv")
    if uv is None:
        raise AssertionError(
            f"cannot parse {rel(path)}: PyYAML is not importable and `uv` is not on PATH. "
            "Run this suite the way the pre-commit hook does: "
            "`uv run --with pytest python -m pytest -q scripts/tests`."
        )
    # S603 is suppressed because the call takes an argv list with no shell, and
    # every element is a constant or a path resolved from this file's location.
    result = subprocess.run(  # noqa: S603
        [uv, "run", "--quiet", "--with", "pyyaml", "python", "-c", _YAML_TO_JSON, str(path)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=300,
        check=False,
    )
    if result.returncode != 0:
        raise AssertionError(f"{rel(path)} is not valid YAML:\n{result.stderr.strip()}")
    return json.loads(result.stdout)


@cache
def load_yaml(path: Path) -> Any:
    """Parse `path` with a real YAML parser, whichever one is reachable."""
    try:
        import yaml
    except ModuleNotFoundError:
        return _load_yaml_without_pyyaml(path)

    try:
        return yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise AssertionError(f"{rel(path)} is not valid YAML:\n{exc}") from exc


def workflow() -> dict[str, Any]:
    document = load_yaml(WORKFLOW)
    assert isinstance(document, dict), f"{rel(WORKFLOW)} did not parse to a mapping"
    return document


def jobs() -> dict[str, Any]:
    document = workflow()
    found = document.get("jobs")
    assert isinstance(found, dict), f"{rel(WORKFLOW)} defines no jobs mapping"
    assert found, f"{rel(WORKFLOW)} defines no jobs"
    return found


def run_blocks() -> tuple[str, ...]:
    """Every shell command the workflow runs, in job and step order."""
    return tuple(
        step["run"]
        for job in jobs().values()
        for step in (job.get("steps") or [])
        if isinstance(step, dict) and isinstance(step.get("run"), str)
    )


def repository_paths_in(text: str) -> set[str]:
    """The repository-relative paths a shell command names.

    A candidate counts only when its first segment is an entry at the repository
    root, which keeps `p/security-audit` (a Semgrep ruleset), `/dev/null` and
    `8000/health` out without naming any of them.
    """
    top_level = {entry.name for entry in REPO_ROOT.iterdir()}
    return {
        token
        for token in PATH_TOKEN.findall(text)
        if token.split("/", 1)[0] in top_level and ".." not in token.split("/")
    }


def local_hook_gates() -> dict[str, tuple[str, ...]]:
    """What each `repo: local` pre-commit hook must be findable by, per hook id.

    A hook that names repository paths is identified by those paths, so the
    workflow may add flags or a pipeline around the same script. A hook that
    names none — a packaged tool, say — is identified by its whole `entry`,
    because there is nothing narrower to match on.
    """
    config = load_yaml(PRE_COMMIT)
    assert isinstance(config, dict), f"{rel(PRE_COMMIT)} did not parse to a mapping"

    gates: dict[str, tuple[str, ...]] = {}
    for repo in config.get("repos") or []:
        if repo.get("repo") != "local":
            continue
        for hook in repo.get("hooks") or []:
            entry = hook["entry"]
            named = tuple(
                token
                for token in shlex.split(entry)
                if "/" in token and (REPO_ROOT / token).exists()
            )
            gates[hook["id"]] = named or (entry,)
    return gates


def python_projects() -> set[str]:
    """Every directory in the working tree holding a `pyproject.toml`.

    Enumerated through git so that ignored trees — virtualenvs, `node_modules`,
    build output — are excluded by `.gitignore` rather than by a list here, and
    with `--others` so that a project added but not yet committed still counts.
    """
    git = shutil.which("git")
    assert git is not None, "git is not on PATH"
    # S603: argv list, no shell, constant arguments.
    result = subprocess.run(  # noqa: S603
        [git, "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=120,
        check=True,
    )
    return {
        PurePosixPath(name).parent.as_posix()
        for name in result.stdout.split("\0")
        if PurePosixPath(name).name == "pyproject.toml"
    }


def test_the_backend_workflow_is_valid_yaml_and_every_job_has_steps() -> None:
    for name, job in jobs().items():
        steps = job.get("steps")
        assert steps, f"{rel(WORKFLOW)}: job {name!r} has no steps"


def test_every_gate_this_repository_defines_runs_as_a_workflow_step() -> None:
    gates = local_hook_gates()
    assert gates, (
        f"derived no local hooks from {rel(PRE_COMMIT)} — the derivation is broken, "
        "and a broken derivation is a test that cannot fail"
    )

    commands = "\n".join(run_blocks())
    missing = {
        hook_id: [needle for needle in needles if needle not in commands]
        for hook_id, needles in gates.items()
    }
    missing = {hook_id: absent for hook_id, absent in missing.items() if absent}

    assert not missing, (
        f"{rel(WORKFLOW)} runs no step for these {rel(PRE_COMMIT)} local hooks: "
        + "; ".join(
            f"{hook_id} (expected a run: naming {absent})" for hook_id, absent in missing.items()
        )
        + ". Every gate the hooks define must also be a step of its own, or CI "
        "enforces less than a developer's pre-commit does."
    )


def test_every_repository_path_the_workflow_runs_exists() -> None:
    missing = sorted(
        {
            path
            for command in run_blocks()
            for path in repository_paths_in(command)
            if not (REPO_ROOT / path).exists()
        }
    )
    assert not missing, f"{rel(WORKFLOW)} runs commands naming paths that do not exist: {missing}"


def test_every_python_script_the_workflow_runs_compiles() -> None:
    scripts = sorted(
        {
            path
            for command in run_blocks()
            for path in repository_paths_in(command)
            if path.endswith(".py")
        }
    )
    assert scripts, f"{rel(WORKFLOW)} runs no repository Python script — it used to run several"

    for script in scripts:
        source = (REPO_ROOT / script).read_text(encoding="utf-8")
        try:
            compile(source, script, "exec")
        except SyntaxError as exc:
            raise AssertionError(
                f"{rel(WORKFLOW)} runs {script}, which does not compile: {exc}"
            ) from exc


def test_the_project_matrix_covers_every_python_project() -> None:
    projects = python_projects()
    assert projects, (
        "found no pyproject.toml anywhere in the working tree — the derivation is broken"
    )

    job = jobs().get(PROJECT_JOB)
    assert job is not None, f"{rel(WORKFLOW)} has no {PROJECT_JOB!r} job"
    matrix = job.get("strategy", {}).get("matrix", {}).get(PROJECT_JOB)
    assert isinstance(matrix, list), (
        f"{rel(WORKFLOW)}: the {PROJECT_JOB!r} job has no {PROJECT_JOB} matrix"
    )
    assert matrix, f"{rel(WORKFLOW)}: the {PROJECT_JOB} matrix is empty"

    unchecked = sorted(projects - set(matrix))
    stale = sorted(set(matrix) - projects)
    assert not unchecked, (
        f"these directories hold a pyproject.toml and are absent from the {PROJECT_JOB} matrix "
        f"in {rel(WORKFLOW)}, so nothing lints, type-checks or tests them: {unchecked}"
    )
    assert not stale, (
        f"the {PROJECT_JOB} matrix in {rel(WORKFLOW)} names directories with no pyproject.toml: {stale}"
    )


def test_this_suite_is_running_the_repository_it_is_checking() -> None:
    """Guards the path arithmetic above, which every other test here depends on."""
    assert WORKFLOW.is_file(), f"{rel(WORKFLOW)} not found from {Path(__file__)} on {sys.platform}"
    assert PRE_COMMIT.is_file(), f"{rel(PRE_COMMIT)} not found"
