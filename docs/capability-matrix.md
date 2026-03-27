# Capability Matrix

This file explains what is centralized, what is externally installed, and how to read the dashboard profile states.

## Centralized Layers

These are managed directly from this repository:

- shared baseline policy: `shared/baseline-policy.md`
- per-CLI overlays in `shared/overlays/`
- generated instruction files under `generated/`
- OpenCode config: `~/.config/opencode/opencode.jsonc`
- capability benchmark prompts: `docs/capability-test-bench.json`

## Profile Status Model

- `managed`: the hub is actively delivering the intended instruction path and the optional workflow layer is aligned with that managed setup
- `detected`: the CLI and its local files were found, but the machine is using a different or more minimal setup than the hub's managed target
- `broken`: a config could not be parsed or another hard failure prevents the hub from reading the live state reliably

This status is about introspection and delivery, not about forcing one plugin stack on every user.

## Tool By Tool

### Codex

Centralized here:

- baseline + Codex overlay
- generated `generated/codex/AGENTS.md`
- local `superpowers` skill files under the shared checkout

Runtime dependency:

- Codex discovers user skills from `~/.agents/skills/superpowers`

Important constraint:

- that same global discovery path is also visible to OpenCode

### Claude Code

Centralized here:

- baseline + Claude overlay
- generated `generated/claude/CLAUDE.md`

External runtime dependency:

- `superpowers@claude-plugins-official`

Important constraint:

- local edits to the `superpowers` checkout do not rewrite the Claude plugin payload

### Gemini CLI

Centralized here:

- baseline + Gemini overlay
- generated `generated/gemini/GEMINI.md`
- local `superpowers` checkout, because Gemini links the extension from disk

Runtime dependency:

- linked `superpowers` extension

### OpenCode

Centralized here:

- baseline + OpenCode overlay
- generated `generated/opencode/default-instructions.md`
- OpenCode plugin selection through guarded config actions

External runtime dependency:

- the `oh-my-opencode` package itself

Important constraints:

- if `oh-my-opencode` and global `superpowers` are both visible, the profile stays `detected` rather than fully `managed`
- global `superpowers` visibility cannot be isolated to OpenCode only on this machine

Current live tradeoff:

- the machine can keep Codex on shared global `superpowers`
- or it can give OpenCode the clean single-harness profile
- it cannot do both at the same time through the current platform paths

## Why The Dashboard Shows Active Vs Editable

Not every active capability is editable from the hub.

Examples:

- Codex global `superpowers`: active and editable
- Gemini linked `superpowers`: active and editable
- Claude plugin payload: active but external
- `oh-my-opencode`: active but external
- generated instruction files: active outputs, read-only in the dashboard
- raw secret-bearing runtime configs: intentionally excluded from the editor surface

That split is the main difference between a real control plane and a misleading “single source of truth” claim.

## UI Skill Pack Decision

Do not install `ui-ux-promax` by default.

Current stack already gives you:

- superpowers planning discipline for Codex and Gemini
- Claude plugin workflow steering
- `oh-my-opencode` and its built-in `frontend-ui-ux` path

Use the capability bench first. Install an extra UI pack only if repeated benchmark runs show a real and specific gap.
