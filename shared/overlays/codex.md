# Codex Overlay

## Delivery Model

- This profile is delivered through `~/.codex/AGENTS.md`, which should resolve to the generated file inside `agent-rules-hub/generated/codex/AGENTS.md`.
- Codex discovers user skills from `~/.agents/skills/`.
- This hub expects `superpowers` to be visible at `~/.agents/skills/superpowers`.

## Steering

- When `superpowers` is available, infer the correct workflow from intent. The user should not need to type `/brainstorm`, `/debug`, or similar explicit commands.
- If `superpowers` is missing or hidden, say that clearly and fall back to native Codex behavior instead of pretending the skill exists.
- Codex built-in system skills under `~/.codex/skills/.system` remain available in addition to the shared skill directory.

## Frontend Verification

- For frontend or UI work, functional tests do not prove visual quality.
- Do not claim a UI is fixed, polished, or good-looking without fresh desktop and mobile evidence from the current build.
- Include blunt self-critique of the most obvious remaining visual debt instead of only positive framing.
- If external model review influenced the result, state the exact model actually used and whether it produced actionable output.

## Constraint

- The `~/.agents/skills` path is shared with OpenCode on this machine, so global `superpowers` visibility affects both tools.
