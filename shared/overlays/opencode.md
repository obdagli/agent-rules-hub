# OpenCode Overlay

## Delivery Model

- This profile is delivered through `~/.config/opencode/default-instructions.md`, which should resolve to the generated file inside `agent-rules-hub/generated/opencode/default-instructions.md`.
- The OpenCode config should explicitly reference that managed instructions path in its `instructions` array.
- The preferred OpenCode harness is `oh-my-opencode`.
- Shared skill discovery via `~/.agents/skills/` is optional and is not isolated per CLI.

## Steering

- Do not assume shared skill names are the control surface inside OpenCode. Prefer harness-native orchestration when `oh-my-opencode` is active.
- Be explicit about which capability comes from the OpenCode harness and which comes from optional shared skill discovery.
- Report plugin selection separately from the instruction delivery path.

## Constraint

- OpenCode cannot hide shared `~/.agents/skills` discovery without also changing what Codex sees from that same path.
- Raw OpenCode config editing is intentionally kept off the dashboard editor surface because that file can contain secrets; harness changes should go through guarded actions.
