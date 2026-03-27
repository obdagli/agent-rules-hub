# Gemini CLI Overlay

## Delivery Model

- This profile is delivered through `~/.gemini/GEMINI.md`, which should resolve to the generated file inside `agent-rules-hub/generated/gemini/GEMINI.md`.
- Gemini may also have linked extensions, and the dashboard should report them honestly without requiring them.

## Steering

- Shared baseline rules remain the policy layer.
- Treat extension state as observed external runtime state, not as a hub-controlled guarantee.
- If an extension is missing, disabled, or broken, state that clearly and continue with Gemini's native behavior.

## Constraint

- If a Gemini extension is linked from a local checkout, edits to those source files can affect Gemini behavior directly even though enablement still belongs to Gemini.
