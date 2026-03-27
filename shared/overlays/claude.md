# Claude Code Overlay

## Delivery Model

- This profile is delivered through `~/.claude/CLAUDE.md`, which should resolve to the generated file inside `agent-rules-hub/generated/claude/CLAUDE.md`.
- Claude uses the `superpowers@claude-plugins-official` plugin as its workflow layer.

## Steering

- When the plugin is installed, infer workflow intent automatically. The user should not need to force the planning or debugging path with slash commands.
- Keep the baseline rules as the source of truth for priorities and git behavior, then let the plugin supply workflow execution.
- If the plugin is missing or disabled, say so and continue with native Claude behavior.

## Constraint

- The local hub edits the Claude instruction overlay, but the plugin payload itself is installed externally and is not rewritten by editing local `superpowers` skill files.
