<!-- All four sections are required. Terse is fine; empty is not. -->

## What changed

<!-- The concrete behaviour or structural change. What does the system do or
refuse now that it didn't before? A pure move states what moved and asserts,
with evidence below, what didn't change. -->

## Domain rules in play

<!-- Which hard rules (`CLAUDE.md`) or conventions (`docs/CONVENTIONS.md`, by
section) this change touches, and how it respects them. "None" is itself a
claim — say why it holds. -->

## Verification evidence

<!-- Paste the commands you ran and their actual output (result lines, not the
full scroll). A ticked checkbox is not evidence — this repository's
characteristic failure is false assurance, and a green claim without output is
how it happens.

    $ pnpm check
    ...
    $ uv run pytest
    567 passed in 78.1s

For a bugfix or a new refusal: demonstrate the red before you trust the green —
show the failing output (or the failing test) from before the fix. -->

## Risks and limitations

<!-- Material risks, unproven residuals, what this does NOT protect against and
what would close it. An honest residual beats a silent one; if a safety
property has no machine behind it yet, say so here rather than in a comment
that asserts it. -->
