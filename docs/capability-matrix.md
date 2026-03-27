# Capability Matrix

This file defines the product boundary for Agent Rules Hub:

- **What the hub controls:** local instruction-source files, generated outputs, selected local runtime config files, and a few guarded local actions.
- **What the hub does not control:** external plugin/extension package payloads and lifecycle.

## Status Model (truthful scope)

- `managed`: the CLI's instruction delivery path is wired to this repo.
- `detected`: the CLI exists, but its instruction delivery path is not wired to this repo.
- `broken`: parse/runtime errors prevented reliable state introspection.

Status is about **delivery wiring + readable state**, not forcing one plugin stack.

## Per-CLI Boundary

### Codex

Hub-controlled:
- `shared/baseline-policy.md` + `shared/overlays/codex.md`
- `generated/codex/AGENTS.md`
- `~/.codex/AGENTS.md` wiring (via bootstrap/orchestrator action)

Observed (external/shared):
- shared skill discovery path under `~/.agents/skills`
- Codex system skills under `~/.codex/skills/.system`

Constraint:
- `~/.agents/skills` is shared with OpenCode.

### Claude Code

Hub-controlled:
- `shared/baseline-policy.md` + `shared/overlays/claude.md`
- `generated/claude/CLAUDE.md`
- `~/.claude/CLAUDE.md` wiring

Observed (external):
- plugin state from `claude plugins list`

Constraint:
- plugin payload/install lifecycle is outside this repo.

### Gemini CLI

Hub-controlled:
- `shared/baseline-policy.md` + `shared/overlays/gemini.md`
- `generated/gemini/GEMINI.md`
- `~/.gemini/GEMINI.md` wiring

Observed (external):
- extension/link/enablement state from `gemini extensions list`

Constraint:
- extension lifecycle is external even when linked to local paths.

### OpenCode

Hub-controlled:
- `shared/baseline-policy.md` + `shared/overlays/opencode.md`
- `generated/opencode/default-instructions.md`
- instruction wiring in `~/.config/opencode/opencode.jsonc`
- optional plugin-array edits in `opencode.jsonc`

Observed (external):
- plugin package internals
- shared skill path side effects through `~/.agents/skills`

Constraint:
- shared skill visibility is global for Codex/OpenCode on this machine.

## Practical Reading Rule

If the dashboard says `managed`, trust instruction-path delivery.
If it also shows plugins/extensions, treat those as **observed runtime layers** unless explicitly stated as hub-controlled file edits.
