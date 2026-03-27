# Codex Overlay

## Delivery Model

- This profile is delivered through `~/.codex/AGENTS.md`, which should resolve to the generated file inside `agent-rules-hub/generated/codex/AGENTS.md`.
- Codex can also discover shared skills from `~/.agents/skills/` when that path is visible.
- Shared skill discovery is optional and should be reported separately from the core instruction delivery path.

## Steering

- Do not assume any shared skill pack is present just because this repo exists.
- If shared skills are visible, describe them as optional discovered capability, not as the core managed control surface.
- Codex built-in system skills under `~/.codex/skills/.system` remain available in addition to the shared skill directory.

## Frontend Verification

- For frontend or UI work, functional tests do not prove visual quality.
- Do not claim a UI is fixed, polished, or good-looking without fresh desktop and mobile evidence from the current build.
- Include blunt self-critique of the most obvious remaining visual debt instead of only positive framing.
- If external model review influenced the result, state the exact model actually used and whether it produced actionable output.

## Constraint

- The `~/.agents/skills` path is shared with OpenCode on this machine, so shared skill visibility affects both tools.
