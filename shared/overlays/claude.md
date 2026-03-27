# Claude Code Overlay

## Delivery Model

- This profile is delivered through `~/.claude/CLAUDE.md`, which should resolve to the generated file inside `agent-rules-hub/generated/claude/CLAUDE.md`.
- Claude may also have external plugins installed, and the dashboard should report them honestly without requiring them.

## Steering

- Keep the baseline rules as the source of truth for priorities and git behavior.
- Treat plugin state as observed external runtime state, not as a hub-controlled guarantee.
- If a plugin is missing or disabled, say so and continue with native Claude behavior.

## Constraint

- The local hub edits the Claude instruction overlay, but plugin payloads are installed externally and are not rewritten by editing local skill files.
