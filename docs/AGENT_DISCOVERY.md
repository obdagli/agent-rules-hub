# Agent Discovery

Agent Rules Hub is intentionally focused on **4 supported CLIs** today:

- Codex
- Claude Code
- Gemini CLI
- OpenCode

This support is implemented in code, primarily in:

- `lib/hub-config.mjs`
- `lib/state.mjs`
- `lib/instructions.mjs`

This document describes the current discovery model. It is **not** a live config file and editing it does not add support for new CLIs by itself.

## What the hub discovers today

### Rule files

The dashboard can discover common file-backed rule locations such as:

- `~/AGENTS.md`
- `~/.codex/AGENTS.md`
- `~/.claude/CLAUDE.md`
- `~/.gemini/GEMINI.md`
- OpenCode home instruction paths
- repo-local `AGENTS.md` files found during discovery scans

### Skill files

The dashboard can discover common skill roots such as:

- `~/.agents/skills`
- `~/.codex/skills`
- the detected `superpowers/skills` checkout

### Runtime config files

For supported CLIs, the dashboard also reads selected runtime config surfaces:

- `~/.codex/config.toml`
- `~/.claude/settings.json`
- Gemini extension state discovered from the `gemini` CLI when available (not a dedicated dashboard-editable runtime config file today)
- `~/.config/opencode/opencode.jsonc`

## Delivery model

The repo composes:

- `shared/baseline-policy.md`
- `shared/overlays/<cli>.md`

into runtime-generated outputs under:

```text
generated/codex/AGENTS.md
generated/claude/CLAUDE.md
generated/gemini/GEMINI.md
generated/opencode/default-instructions.md
```

Home-level CLI paths are then wired to those generated files by the helper scripts.

## Scope boundary

This repo does **not** claim universal introspection across every agent ecosystem.

If new CLIs are added in the future, they will require code changes plus tests and docs updates.
