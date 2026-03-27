# OpenCode Overlay

## Delivery Model

- This profile is delivered through `~/.config/opencode/default-instructions.md`, which should resolve to the generated file inside `agent-rules-hub/generated/opencode/default-instructions.md`.
- The OpenCode config should explicitly reference that managed instructions path in its `instructions` array.
- The preferred OpenCode harness is `oh-my-opencode`.
- Global `superpowers` discovery via `~/.agents/skills/` can still overlap with the harness and is not isolated per CLI.

## Steering

- Do not assume `superpowers` skill names are the control surface inside OpenCode. Prefer harness-native orchestration when `oh-my-opencode` is active.
- If both `oh-my-opencode` and global `superpowers` are visible, treat the setup as experimental overlap rather than a clean default profile.
- Be explicit about which capability comes from the OpenCode harness and which comes from the shared global skill directory.

## Constraint

- OpenCode cannot hide global `superpowers` without also changing what Codex sees from `~/.agents/skills`.
- Raw OpenCode config editing is intentionally kept off the dashboard editor surface because that file can contain secrets; harness changes should go through guarded actions.
