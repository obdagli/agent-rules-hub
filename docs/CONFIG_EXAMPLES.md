# Configuration Notes

Agent Rules Hub does **not** currently load a YAML or JSON config file.

The repo is configured through:

- source files in `shared/`
- generated outputs under `generated/`
- helper scripts in `scripts/`
- environment variables used by the bootstrap/runtime helpers

## Supported environment variables

### `WORKSPACE_ROOT`

Overrides the default workspace root used by path resolution.

Default:

```bash
~/workspace
```

### `SUPERPOWERS_ROOT`

Overrides the detected superpowers checkout path.

### `XDG_CONFIG_HOME`

Overrides the base config directory used for OpenCode paths.

### `AGENT_RULES_DASHBOARD_PORT`

Overrides the dashboard port.

Default:

```bash
4848
```

### `AGENT_RULES_DASHBOARD_TOKEN`

Optional fixed token for the local dashboard API.

## Typical local setup

```bash
export WORKSPACE_ROOT=~/workspace
export SUPERPOWERS_ROOT=~/workspace/superpowers
export XDG_CONFIG_HOME=$HOME/.config
```

Then:

```bash
npm run dashboard
```

or for home wiring:

```bash
./scripts/bootstrap-home.sh
```

`bootstrap-home.sh` always handles the local generated-file wiring first. `ais` and `superpowers` integrations are best-effort extras when those tools/checkouts are present.

## Generated outputs

Effective instruction files are generated locally under:

```text
generated/codex/AGENTS.md
generated/claude/CLAUDE.md
generated/gemini/GEMINI.md
generated/opencode/default-instructions.md
```

These are build artifacts, not source-of-truth files.
Edit the source layers in `shared/` instead.

## systemd installation

Use the helper instead of manually editing unit paths:

```bash
./scripts/install-dashboard-service.sh
systemctl --user daemon-reload
systemctl --user enable --now agent-rules-hub-dashboard
```
