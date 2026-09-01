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

Eight things are checked. The first four are about `.github/workflows/backend.yml`;
5 and 6 hold `.github/workflows/migration-harness.yml` — the one workflow whose
path filter spans both the browser app and the services — to the SAME four rules,
because it makes the same kind of integrity claim in its own header and nothing
was checking it either. 7 and 8 were added on 2026-08-06, when a review found that
the wire fixture the two contract gates share was reachable by NO workflow's path
filter and that the Zod half of that proof never ran on a backend change:

1. the workflow is valid YAML, and every job in it has steps;
2. every hook in the `repo: local` block of `.pre-commit-config.yaml` is
   INVOKED by an ENFORCING `run:` step — the hooks are how this repository
   writes down what its gates are, so a gate added there and not here is a
   workflow that enforces less than the hooks do;
3. every repository path any `run:` names exists, and every `.py` among them
   compiles — a workflow that invokes a renamed script fails five minutes into
   a pipeline instead of here;
4. the `project` matrix covers exactly the set of directories holding a
   `pyproject.toml`. This is the direction that actually happens: a package is
   added, and nothing lints, type-checks or tests it because nobody remembered
   the matrix;
5. the migration harness workflow INVOKES `pnpm test:e2e:live` from an ENFORCING
   step — it boots core-api and installs a browser, so it looks busy whether or
   not it runs an assertion, and a green tick from it is quoted as evidence that
   the browser app still works against the backend;
6. that workflow's `paths` filter still names `apps/**`, `packages/**` AND
   `services/**`, on both `push` and `pull_request`. Losing one of them silently
   restores the gap the workflow was created to close;
7. `contract-fixtures/**` is named by `backend.yml` AND by the harness, on both
   events. The directory holding the fixture is read off the filesystem first, so
   a glob that has stopped matching anything fails as that rather than as a
   trigger nobody notices is dead;
8. the harness INVOKES the contract-parity vitest project from an ENFORCING step.
   `frontend.yml` runs it too and does not watch `services/**`, so the harness is
   the only place it can execute on the change class that regenerates the fixture.

## 🔴 CHECK 2 USED TO ASK WHETHER A NAME APPEARED IN *SOME* `run:` STRING, AND
   FIVE DIFFERENT WORKFLOWS THAT RUN NO GATE AT ALL SATISFIED IT

It was `needle not in "\n".join(run_blocks())` — a substring search over every
`run:` in the file, with no notion of whether that step executes, whether its
result is allowed to fail, or whether the name was being INVOKED or merely
printed. MEASURED 2026-08-06, one injection at a time into
`.github/workflows/backend.yml`, `137 passed` for every one of them:

1. the step's command replaced by `echo "TODO re-enable
   scripts/check_backend_rules.py"` — the gate named and never run;
2. `if: false` on the step;
3. `if: ${{ github.event_name == 'schedule' }}` on the whole `hygiene` job, with
   no `schedule` trigger anywhere in the file — every gate in the job dead;
4. `continue-on-error: true` on all five gate steps — every gate runs, every
   failure ignored, the job green;
5. the script named only in a `#` comment INSIDE a `run: |` block.

Four rules answer them, and `_step_enforces` / `_invocations` hold them:

* the step's `if:` must be ABSENT or exactly `!cancelled()`;
* the step's JOB must carry no `if:` at all;
* neither the step nor its job may carry `continue-on-error`;
* comments are dropped from the block, and the needle must appear as a
  contiguous run of SHELL TOKENS in a command whose command word is not a
  pure-output builtin.

WHICH RULE CATCHES WHICH INJECTION IS MEASURED RATHER THAN ARGUED, because a
rule that is only believed to be load-bearing is a rule nobody will notice
losing. Each of the four was disabled ON ITS OWN and all five injections re-run
against the other three, 2026-08-06:

    rule disabled          injection that then SURVIVED
    step `if:`             2
    job `if:`              3
    continue-on-error      4
    token / builtin        1, and the unquoted `echo scripts/…` variant of it
    `#`-line stripping     none

THAT LAST ROW IS A CORRECTION TO WHAT THIS PARAGRAPH FIRST CLAIMED. Dropping
whole `#` LINES turns out to catch injection 5 REDUNDANTLY: `shlex.split(…,
comments=True)` already reduces `# python scripts/check_backend_rules.py` to no
tokens at all, and the surviving `true` in that step is a pure-output builtin
besides. The line-level strip is kept — it is the one that reads as intentional
and it covers a `#` a future `shlex` might treat differently — but it is not
what is holding injection 5 up today, and saying that it was would have been a
claim about this file that this file disproves.

ON THE TOKEN RULE, STATED PRECISELY BECAUSE IT IS THE ONE THAT IS NOT A YES/NO
READ OF A KEY. The requirement is that the gate be INVOKED rather than mentioned,
and "the line starts with the needle" is NOT available as a spelling of it — no
real gate line does. MEASURED: the workflow runs `python
scripts/check_backend_rules.py` and `git ls-files -z | xargs -0 python
scripts/check_no_client_data.py`, and the needle is in the middle of both. So the
rule is positional in the TOKEN stream instead: `shlex` splits the line, the
tokens are cut at `|`, `&&`, `||`, `;` and `&` into commands, and a command whose
first token is `echo`, `printf`, `:`, `true` or `false` cannot satisfy anything.
Injection 1 is caught twice over, and the two halves were measured apart:
QUOTED, the needle is part of a token rather than a token, so the token rule
alone stops it; UNQUOTED (`run: echo TODO re-enable scripts/…`), the tokens are
right there and only the builtin filter stops it. Both variants were run.

`if: ${{ !cancelled() }}` itself is CORRECT and is what the workflow's own
comment claims it is: each gate reports an independent verdict rather than the
run stopping at the first failure. It is allowed through deliberately, and it is
the only condition that is.

## On the YAML parser

CORRECTED 2026-08-08: `scripts/` IS now a uv project (the seventh — see
`scripts/pyproject.toml`), and inside it PyYAML is a direct dev dependency. The
paragraph below described the pre-project world and still governs the OTHER way
this suite runs — the pre-commit hook's bare
`uv run --with pytest python -m pytest -q scripts/tests`, which builds an
environment with pytest and the standard library, no PyYAML. Rather than skip (a skipped drift test is a drift
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
from typing import Any, cast

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
WORKFLOW = REPO_ROOT / ".github" / "workflows" / "backend.yml"
PRE_COMMIT = REPO_ROOT / ".pre-commit-config.yaml"

# The migration harness — the one workflow whose path filter spans both the
# browser app and the services, and therefore the only thing that runs the e2e
# suite on a backend change. Held to the same `_step_enforces` rules as the
# gates above, because it makes the same kind of claim in its own header:
# "There is no continue-on-error in this file, and the harness step's exit
# status is the job's." That sentence is precisely the artefact class the module
# docstring's five injections are about, so it is asserted rather than believed.
HARNESS_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "migration-harness.yml"

# The pnpm script that IS the harness. A job that boots core-api, installs a
# browser and then runs nothing would satisfy every other check in this file.
HARNESS_SCRIPT = "test:e2e:live"

# The directory holding the wire fixture core-api's Pydantic models and
# `packages/contract`'s Zod schemas are both answerable to. It is DERIVED from the
# filesystem below rather than believed: if it stops existing, the tests naming it
# say so instead of asserting a glob nothing matches.
CONTRACT_FIXTURES_DIR = REPO_ROOT / "contract-fixtures"

# The same directory as a workflow `paths` glob.
CONTRACT_FIXTURES_GLOB = "contract-fixtures/**"

# Both sides of the migration, plus the package the wire contract lives in, plus
# the fixture that belongs to NEITHER tree. The entire value of this workflow is
# that a change to ONE of these runs against the others; a filter that lost
# `services/**` would leave the browser suite exactly as blind to a backend change
# as it was before the workflow existed, and one that loses the fixture glob
# restores the hole where a PR editing only `contract-fixtures/` triggered no
# workflow anywhere in the repository.
HARNESS_REQUIRED_PATHS = ("apps/**", "packages/**", "services/**", CONTRACT_FIXTURES_GLOB)

# The vitest project holding the contract-parity gate, as it is invoked. Named by
# the RUNNER and the PROJECT rather than by the whole `pnpm --filter @titlepipe/web exec …`
# line, on `local_hook_gates`'s principle: identify a gate by the narrowest thing
# that is actually it, so the workflow stays free to change how it is wrapped.
#
# `--project gates` matters and is not decoration. `pnpm --filter @titlepipe/web test`
# would satisfy a looser needle and would drag the Storybook BROWSER suite onto
# every backend commit, which is the cost this workflow was arranged to avoid.
HARNESS_CONTRACT_GATE = "vitest run --project gates"

# The job whose matrix is supposed to enumerate every Python project.
PROJECT_JOB = "project"

# The ONE step condition a gate may carry. See the module docstring: it makes a
# step run more often rather than less, and it is what gives each gate an
# independent verdict after an earlier one has failed. Compared against
# `_expression`, so both `!cancelled()` and `${{ !cancelled() }}` match.
CANCELLED_GUARD = "!cancelled()"

# Where one shell command ends and the next begins. `_invocations` cuts the token
# stream here so that "the first token" is the command word of the command the
# needle is actually in, rather than of whatever started the line — the needle in
# `git ls-files -z | xargs -0 python scripts/check_no_client_data.py` belongs to
# the `xargs` command, not to `git`.
SEGMENT_SEPARATORS = frozenset({"|", "||", "&&", ";", "&"})

# Command words that cannot run a gate however they are spelled. A step that
# PRINTS a gate's name has not run it, and that is measurably not a theoretical
# distinction — see injection 1 in the module docstring.
OUTPUT_ONLY_COMMANDS = frozenset({"echo", "printf", ":", "true", "false"})

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


def workflow(path: Path = WORKFLOW) -> dict[object, Any]:
    """A parsed workflow. Defaults to `backend.yml`, which most checks here mean.

    The parameter exists because the four `_step_enforces` rules are about what
    GitHub does with a step, not about which file the step is in — so any
    workflow making an integrity claim can be held to them. `migration-harness.yml`
    is the second caller; see the tests at the end of this module.

    Keyed by `object`, not `str`, because that is what a parsed workflow really
    is: YAML 1.1 resolves a bare `on` to the boolean `True` — see `triggers`.
    """
    document = load_yaml(path)
    assert isinstance(document, dict), f"{rel(path)} did not parse to a mapping"
    # `cast`, not an annotated binding: the parse boundary is where Unknown
    # enters, and the asserts above are the runtime check the cast leans on.
    return cast(dict[object, Any], document)


def jobs(path: Path = WORKFLOW) -> dict[str, Any]:
    document = workflow(path)
    found = document.get("jobs")
    assert isinstance(found, dict), f"{rel(path)} defines no jobs mapping"
    assert found, f"{rel(path)} defines no jobs"
    return cast(dict[str, Any], found)


def _steps(job: Any) -> list[dict[str, Any]]:
    """A job's step mappings, dropping anything that is not a mapping at all."""
    return [
        cast(dict[str, Any], step)
        for step in cast(list[object], job.get("steps") or [])
        if isinstance(step, dict)
    ]


def run_blocks() -> tuple[str, ...]:
    """Every shell command the workflow runs, in job and step order.

    EVERY ONE, including steps that are conditional or allowed to fail. This
    feeds the path-existence and script-compilation checks, which are about
    whether the file is coherent rather than about whether a gate is enforced —
    a renamed script named in a skipped step is still a workflow that will break
    the day the step is re-enabled. `enforcing_run_blocks` is the narrowed set
    and is used by the gate check alone.
    """
    return tuple(
        step["run"]
        for job in jobs().values()
        for step in _steps(job)
        if isinstance(step.get("run"), str)
    )


def _expression(value: object) -> str:
    """A workflow condition with its `${{ … }}` wrapper removed, whitespace trimmed.

    GitHub accepts `if: ${{ !cancelled() }}` and the bare `if: !cancelled()`
    interchangeably, so a comparison against either spelling alone would refuse a
    workflow that is correct. Unwrapping makes the two one string.
    """
    text = str(value).strip()
    if text.startswith("${{") and text.endswith("}}"):
        text = text[3:-2].strip()
    return text


def _continues_on_error(node: dict[str, Any]) -> bool:
    """Is `continue-on-error` set to anything other than a literal `false`?

    ANY value other than `false` disqualifies, rather than only the boolean
    `true`. `continue-on-error: "true"` is a string to a YAML parser and
    `continue-on-error: ${{ … }}` is an expression this test cannot evaluate, and
    both mean "this step's failure may be ignored". A gate whose result is
    optional is not a gate, so the unreadable case is refused rather than
    guessed at.
    """
    value = node.get("continue-on-error")
    return value is not None and _expression(value).lower() != "false"


def _step_enforces(job: dict[str, Any], step: dict[str, Any]) -> bool:
    """Would this step's failure actually fail the run?

    Three questions, and the module docstring records the injection each one
    answers:

    * the JOB carries no `if:` AT ALL. Not "no falsy `if:`" — the condition is a
      GitHub expression evaluated against a context this test does not have, and
      `github.event_name == 'schedule'` on a workflow with no `schedule` trigger
      reads as perfectly ordinary while disabling every step underneath it. A
      job whose execution cannot be established here is a job whose gates cannot
      be counted;
    * the STEP's `if:` is absent or exactly `!cancelled()`. That one condition is
      permitted because it is the one the workflow actually uses and it makes a
      step run MORE often, not less: it keeps each gate reporting after an
      earlier one has failed;
    * neither carries `continue-on-error`.
    """
    if "if" in job:
        return False
    if _continues_on_error(job) or _continues_on_error(step):
        return False
    condition = step.get("if")
    return condition is None or _expression(condition) == CANCELLED_GUARD


def enforcing_run_blocks(path: Path = WORKFLOW) -> tuple[str, ...]:
    """The `run:` blocks whose failure would fail the workflow. See `_step_enforces`."""
    return tuple(
        step["run"]
        for job in jobs(path).values()
        for step in _steps(job)
        if isinstance(step.get("run"), str) and _step_enforces(job, step)
    )


def _tokenise(line: str) -> list[str]:
    """One shell line as tokens, with any trailing `#` comment dropped.

    `shlex` is what makes a QUOTED mention different from an invoked one:
    `echo "TODO re-enable scripts/x.py"` tokenises to `['echo', 'TODO re-enable
    scripts/x.py']`, in which the path is part of a token and is not one.

    A line `shlex` cannot parse — an unbalanced quote, which shell here-docs and
    `case` patterns produce legitimately — falls back to a whitespace split. That
    is weaker, and it is stated rather than hidden: the fallback is per LINE, so
    it degrades one line rather than the file, and no line in this repository's
    workflow currently takes it.
    """
    try:
        return shlex.split(line, comments=True)
    except ValueError:
        return line.split()


def _invocations(block: str) -> list[list[str]]:
    """Every command in a `run:` block, tokenised, that could actually invoke something.

    `#`-comment LINES are dropped before anything else, so a gate cannot be
    satisfied by a note saying it ought to run. It is REDUNDANT with `_tokenise`'s
    `shlex.split(…, comments=True)`, which reduces a whole comment line to no
    tokens — measured, see the module docstring's attribution table, where
    disabling this strip let nothing through. It is kept because it is the
    legible statement of the rule and because it covers the whole line rather
    than relying on `shlex`'s treatment of `#`, and it is documented as redundant
    rather than as load-bearing.

    Tokens are cut at the shell's command separators, so each element of the
    result is one command and its arguments — that is what makes "the first
    token" mean the command word rather than whatever began the line.

    A command whose command word is a pure-output builtin is DROPPED ENTIRELY.
    Printing a gate's name is not running it, and `echo` is how the first
    injection in the module docstring did exactly that.
    """
    commands: list[list[str]] = []
    for raw in block.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        current: list[str] = []
        for token in _tokenise(line):
            if token in SEGMENT_SEPARATORS:
                if current:
                    commands.append(current)
                current = []
            else:
                current.append(token)
        if current:
            commands.append(current)
    return [command for command in commands if command[0] not in OUTPUT_ONLY_COMMANDS]


def _is_invoked(needle: str, commands: list[list[str]]) -> bool:
    """Does some command contain `needle`'s tokens contiguously, in order?

    A TOKEN SEQUENCE rather than a substring, and contiguous rather than merely
    present. A single-token needle — which is what a hook naming a repository
    path produces — reduces to exact token membership, so the workflow is still
    free to wrap the script in `xargs`, a pipeline or extra flags. A multi-token
    needle is a hook that names no path and is therefore identified by its whole
    `entry`; requiring that entry to appear as a contiguous run is the narrowest
    thing available when there is nothing shorter to match on.
    """
    wanted = _tokenise(needle)
    if not wanted:
        return False
    width = len(wanted)
    return any(
        command[start : start + width] == wanted
        for command in commands
        for start in range(len(command) - width + 1)
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
    parsed = cast(dict[str, Any], config)

    gates: dict[str, tuple[str, ...]] = {}
    for repo in cast(list[dict[str, Any]], parsed.get("repos") or []):
        if repo.get("repo") != "local":
            continue
        for hook in cast(list[dict[str, Any]], repo.get("hooks") or []):
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
    """Every local hook is INVOKED by a step whose failure fails the run.

    Four properties, each measured against an injection that used to ship
    `137 passed` — see the module docstring for all five.
    """
    gates = local_hook_gates()
    assert gates, (
        f"derived no local hooks from {rel(PRE_COMMIT)} — the derivation is broken, "
        "and a broken derivation is a test that cannot fail"
    )

    enforcing = enforcing_run_blocks()
    assert enforcing, (
        f"{rel(WORKFLOW)} has no run: step whose failure would fail the run. Every "
        f"one of them is conditional, continue-on-error, or in a job carrying an "
        f"if: — the assertion below is a loop over this and would report success "
        f"for every gate."
    )

    commands = [command for block in enforcing for command in _invocations(block)]
    missing = {
        hook_id: [needle for needle in needles if not _is_invoked(needle, commands)]
        for hook_id, needles in gates.items()
    }
    missing = {hook_id: absent for hook_id, absent in missing.items() if absent}

    assert not missing, (
        f"{rel(WORKFLOW)} invokes no enforcing step for these {rel(PRE_COMMIT)} "
        "local hooks: "
        + "; ".join(
            f"{hook_id} (expected a run: invoking {absent})" for hook_id, absent in missing.items()
        )
        + f". A step satisfies a gate only when it RUNS it — named as shell tokens "
        f"rather than printed or commented out — and only when its failure counts: "
        f"no continue-on-error, no if: other than {CANCELLED_GUARD}, and no if: on "
        f"its job. Otherwise CI enforces less than a developer's pre-commit does."
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
    entries = cast(list[str], matrix)

    unchecked = sorted(projects - set(entries))
    stale = sorted(set(entries) - projects)
    assert not unchecked, (
        f"these directories hold a pyproject.toml and are absent from the {PROJECT_JOB} matrix "
        f"in {rel(WORKFLOW)}, so nothing lints, type-checks or tests them: {unchecked}"
    )
    assert not stale, (
        f"the {PROJECT_JOB} matrix in {rel(WORKFLOW)} names directories with no pyproject.toml: {stale}"
    )


def triggers(path: Path) -> dict[str, Any]:
    """A workflow's `on:` block.

    THREE SPELLINGS, and every one of them occurs here. YAML 1.1 — which PyYAML
    implements — resolves a bare `on` to the BOOLEAN `True`, so `document["on"]`
    finds nothing. And when PyYAML is unavailable this module reparses through
    `uv run --with pyyaml` and JSON, where that boolean key becomes the STRING
    `"true"`. MEASURED: a first version of this helper read only `True` and
    `"on"`, passed under a local PyYAML and failed under the JSON fallback that
    CI actually takes. A quoted `"on":` in the workflow would give the third.

    Getting this wrong is not a loud failure in general — a lookup that finds no
    triggers leaves an assertion with nothing to object to.
    """
    document = workflow(path)
    for key in (True, "on", "true"):
        found = document.get(key)
        if isinstance(found, dict):
            return cast(dict[str, Any], found)
    raise AssertionError(f"{rel(path)} has no `on:` mapping of triggers")


def test_the_migration_harness_workflow_runs_the_harness_from_an_enforcing_step() -> None:
    """`migration-harness.yml` actually invokes the live suite, and its failure counts.

    The four rules are `backend.yml`'s, unchanged and imported rather than
    restated — see `_step_enforces` and `_invocations`. This workflow is worth
    holding to them for the same reason `backend.yml` is: it boots a service and
    installs a browser, so it LOOKS busy whether or not it runs an assertion,
    and it is the only job in the repository that reaches both sides of the
    migration. A green tick from it is quoted as evidence that the browser app
    still works against core-api.
    """
    for name, job in jobs(HARNESS_WORKFLOW).items():
        assert job.get("steps"), f"{rel(HARNESS_WORKFLOW)}: job {name!r} has no steps"

    enforcing = enforcing_run_blocks(HARNESS_WORKFLOW)
    assert enforcing, (
        f"{rel(HARNESS_WORKFLOW)} has no run: step whose failure would fail the run — "
        "every one of them is conditional, continue-on-error, or in a job carrying "
        "an if:. The assertion below would then be looking at an empty list."
    )

    commands = [command for block in enforcing for command in _invocations(block)]
    assert _is_invoked(HARNESS_SCRIPT, commands), (
        f"{rel(HARNESS_WORKFLOW)} never invokes {HARNESS_SCRIPT!r} from a step whose "
        f"failure would fail the run. A step satisfies this only when it RUNS the "
        f"harness — named as shell tokens rather than printed or commented out — and "
        f"only when its result counts: no continue-on-error, no if: other than "
        f"{CANCELLED_GUARD}, and no if: on its job. Otherwise the workflow boots "
        f"core-api, installs a browser, and proves nothing."
    )


def test_the_migration_harness_workflow_watches_both_sides_of_the_migration() -> None:
    """Its path filter spans the app AND the services, on push and on pull_request.

    This is the whole reason the file exists. `frontend.yml` watches `apps/**`
    and `packages/**`; `backend.yml` watches `services/**`, `libs/**`, `infra/**`
    and `scripts/**`; they do not overlap, so before this workflow no job ran the
    browser suite on a backend change. A filter that quietly lost `services/**`
    would restore that gap while leaving the workflow looking correct.
    """
    on = triggers(HARNESS_WORKFLOW)

    for event in ("push", "pull_request"):
        block = on.get(event)
        assert isinstance(block, dict), (
            f"{rel(HARNESS_WORKFLOW)} has no {event} trigger — a workflow that does not "
            f"run on {event} cannot gate one"
        )
        paths = cast(dict[str, Any], block).get("paths")
        assert isinstance(paths, list), (
            f"{rel(HARNESS_WORKFLOW)}: the {event} trigger declares no paths filter"
        )
        declared = cast(list[str], paths)
        missing = [wanted for wanted in HARNESS_REQUIRED_PATHS if wanted not in declared]
        assert not missing, (
            f"{rel(HARNESS_WORKFLOW)}: the {event} paths filter is missing {missing}. "
            f"The point of this workflow is that a change to one side of the migration "
            f"runs against the other; without all of {list(HARNESS_REQUIRED_PATHS)} it "
            f"is a second frontend or backend job with extra steps."
        )


def paths_filter(path: Path, event: str) -> list[str]:
    """A workflow's `paths` list for one trigger, off the PARSED document.

    Parsed and not grepped, deliberately. `01-WHAT-HAPPENED.md` §5 lists five CI
    checks that shipped green because they matched a NAME somewhere in the YAML —
    including one that matched a name inside a `#` comment. A `contract-fixtures/**`
    written in this file's own explanatory comment, or in the workflow's, must not
    satisfy anything; only an entry in the list GitHub actually evaluates can.
    """
    block = triggers(path).get(event)
    assert isinstance(block, dict), (
        f"{rel(path)} has no {event} trigger — a workflow that does not run on "
        f"{event} cannot gate one"
    )
    found = cast(dict[str, Any], block).get("paths")
    assert isinstance(found, list), (
        f"{rel(path)}: the {event} trigger declares no paths filter, so it runs on "
        f"every change and this assertion has nothing to check"
    )
    return [str(entry) for entry in cast(list[object], found)]


def test_the_shared_contract_fixture_triggers_the_workflows_that_gate_it() -> None:
    """A change to `contract-fixtures/` must reach a workflow. It used to reach none.

    🔴 MEASURED 2026-08-06, before this assertion existed. The fixture sits at the
       repository ROOT because it belongs to neither tree — core-api's Pydantic
       models produce it and `packages/contract`'s Zod schemas must accept it. That
       is the right home and it had a consequence nobody had checked:

           frontend.yml   apps/** packages/** + workspace files   -> no match
           backend.yml    services/** libs/** infra/** scripts/** -> no match
           harness        apps/** packages/** services/** libs/** -> no match

       A pull request editing ONLY the artifact both contract gates hang off ran
       nothing. Both of the workflows that can execute a gate over it now name it.

    `frontend.yml` is deliberately NOT in this list. It runs the parity test as part
    of `pnpm --filter @titlepipe/web test`, and adding `services/**` to it — the other way to
    close the hole — would put the Storybook browser suite on every backend commit.
    The harness is where both sides meet, and it is where the gate was added.
    """
    assert CONTRACT_FIXTURES_DIR.is_dir(), (
        f"{rel(CONTRACT_FIXTURES_DIR)} does not exist, so the globs asserted below "
        f"name nothing. Either the fixture moved — in which case these constants "
        f"move with it — or it was deleted, in which case the two contract gates "
        f"have no shared artifact left."
    )
    fixtures = sorted(entry.name for entry in CONTRACT_FIXTURES_DIR.iterdir() if entry.is_file())
    assert fixtures, (
        f"{rel(CONTRACT_FIXTURES_DIR)} is empty. A path filter naming a directory "
        f"with nothing in it is a trigger that can never fire."
    )

    for path in (WORKFLOW, HARNESS_WORKFLOW):
        for event in ("push", "pull_request"):
            declared = paths_filter(path, event)
            assert CONTRACT_FIXTURES_GLOB in declared, (
                f"{rel(path)}: the {event} paths filter does not name "
                f"{CONTRACT_FIXTURES_GLOB!r}, so a change to {fixtures} runs nothing "
                f"here. It declares {declared}."
            )


def test_the_migration_harness_runs_the_contract_gate_from_an_enforcing_step() -> None:
    """The harness invokes the contract-parity vitest project, and its failure counts.

    🔴 THIS IS THE HOLE THE GATE WAS BUILT WITH, and it is a different one from the
       path filter above. `contract-parity.test.ts` parses core-api's response
       fixture with the real Zod schemas — it is the ONLY check that can say "the
       contract refuses this shape". It runs in `frontend.yml`, whose filter names
       `apps/**` and `packages/**` and NOT `services/**`.

       So the change class it exists for — edit `api/schemas/rules.py`, regenerate
       the fixture, open a PR — ran `backend.yml` ALONE. The Python half of the proof
       passes there BY CONSTRUCTION, because the fixture was regenerated from the
       models it is being compared against, and the Zod half never executed. Every
       endpoint Plan 02 Task 4 and later produce is that change class.

    Held to `_step_enforces` and `_invocations`, unchanged and imported rather than
    restated — so the five injections in the module docstring apply to this step as
    they do to every other gate in this repository.
    """
    enforcing = enforcing_run_blocks(HARNESS_WORKFLOW)
    assert enforcing, (
        f"{rel(HARNESS_WORKFLOW)} has no run: step whose failure would fail the run — "
        "every one of them is conditional, continue-on-error, or in a job carrying "
        "an if:. The assertion below would then be looking at an empty list."
    )

    commands = [command for block in enforcing for command in _invocations(block)]
    assert _is_invoked(HARNESS_CONTRACT_GATE, commands), (
        f"{rel(HARNESS_WORKFLOW)} never invokes {HARNESS_CONTRACT_GATE!r} from a step "
        f"whose failure would fail the run. This is the only workflow whose filter "
        f"spans `services/**` AND `apps/**`, so without this step a backend change "
        f"that regenerates the wire fixture is checked only against the Python that "
        f"produced it. A step satisfies this only when it RUNS the gate — named as "
        f"shell tokens rather than printed or commented out — and only when its "
        f"result counts: no continue-on-error, no if: other than {CANCELLED_GUARD}, "
        f"and no if: on its job."
    )


def test_this_suite_is_running_the_repository_it_is_checking() -> None:
    """Guards the path arithmetic above, which every other test here depends on."""
    assert WORKFLOW.is_file(), f"{rel(WORKFLOW)} not found from {Path(__file__)} on {sys.platform}"
    assert PRE_COMMIT.is_file(), f"{rel(PRE_COMMIT)} not found"
    assert HARNESS_WORKFLOW.is_file(), f"{rel(HARNESS_WORKFLOW)} not found"
