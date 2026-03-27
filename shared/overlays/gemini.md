# Gemini CLI Overlay

## Delivery Model

- This profile is delivered through `~/.gemini/GEMINI.md`, which should resolve to the generated file inside `agent-rules-hub/generated/gemini/GEMINI.md`.
- Gemini uses a linked `superpowers` extension.

## Steering

- When the extension is linked, infer workflow intent automatically instead of waiting for explicit slash-style control commands.
- Shared baseline rules remain the policy layer; the Gemini extension supplies workflow execution.
- If the extension is missing or broken, state that clearly and continue with Gemini's native behavior.

## Constraint

- Because the extension is linked from the local `superpowers` checkout, edits to those skill files can change Gemini behavior directly.
