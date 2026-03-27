# Agent Rules Hub Architecture

This document describes the architecture and design of Agent Rules Hub, a unified control plane for managing AI coding agent configurations.

## Overview

Agent Rules Hub solves the problem of managing instruction files, skills, plugins, and configurations across multiple AI coding assistants. It provides:

- **Centralized rule management** - Edit baseline rules and per-CLI overlays in one place
- **Instruction composition** - Combine baseline + overlays into generated instruction files
- **Runtime awareness** - Track what's hub-managed vs external (plugins, system skills)
- **Live dashboard** - Web UI for inspection and configuration management
- **Multi-CLI support** - Supports Codex, Claude Code, Gemini CLI, and OpenCode today; adding more CLIs requires code, tests, and docs updates

## Core Concepts

### Layer Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Shared Baseline Policy                    │
│              (common rules for all agents)                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Codex Overlay│  │Claude Overlay│  │Gemini Overlay│  ...
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                         ▼
              ┌────────────────────┐
              │  Render Engine     │
              │  (compose + write) │
              └─────────┬──────────┘
                        ▼
         ┌──────────────────────────────┐
         │   Generated Instructions      │
         │  (one file per CLI tool)     │
         └──────────────────────────────┘
```

### Hub-Managed vs External

The hub is "architecturally honest" about what it controls:

| Category | Description | Examples |
|----------|-------------|----------|
| **Hub-Managed** | Fully controlled by this repo | Source overlays, generated outputs, selected runtime configs |
| **External** | Outside hub control | Claude plugin payloads, harness internals, system skills |

### Delivery Models

Each CLI has a different instruction delivery model:

| CLI | Home Path | Generated File | Runtime Config | External Dependency |
|-----|-----------|----------------|----------------|---------------------|
| Codex | `~/.codex/AGENTS.md` | `generated/codex/AGENTS.md` | `~/.codex/config.toml` | Global skills at `~/.agents/skills/` |
| Claude | `~/.claude/CLAUDE.md` | `generated/claude/CLAUDE.md` | `~/.claude/settings.json` | `superpowers@claude-plugins-official` |
| Gemini | `~/.gemini/GEMINI.md` | `generated/gemini/GEMINI.md` | No dedicated dashboard-editable runtime config file today | Linked extension at checkout |
| OpenCode | `~/.config/opencode/default-instructions.md` | `generated/opencode/default-instructions.md` | `~/.config/opencode/opencode.jsonc` | Harness plugins |

## System Components

### 1. Core Modules (`lib/`)

#### `hub-config.mjs`

Central configuration that defines:
- CLI profiles with paths and metadata
- File locations (HUB_FILES)
- Capability definitions
- Superpowers root resolution

```javascript
export const CLI_PROFILES = {
  codex: { id, label, overlayPath, generatedPath, homePath, ... },
  claude: { ... },
  // ...
};
```

#### `instructions.mjs`

Instruction rendering engine:
- `renderAllInstructions()` - Compose baseline + overlays, write generated files
- `isInstructionSourcePath()` - Check if a path is a source layer
- Reads baseline and overlays, concatenates with headers

#### `state.mjs`

Dashboard state builder:
- `buildDashboardState()` - Main function that builds the full state object
- `evaluateProfileStatus()` - Determine if a CLI profile is managed/detected/broken
- `getManagedFiles()` - List all editable files
- Parses runtime configs (TOML, JSONC, JSON)
- Detects plugins, extensions, skills

#### `opencode-config.mjs`

OpenCode-specific config handling:
- `getOpencodeDeliveryState()` - Check if OpenCode is using hub instructions
- Guarded config updates with validation

#### `jsonc.mjs`

JSONC (JSON with comments) parser for configs.

### 2. Dashboard Server (`dashboard/`)

#### `server.mjs`

HTTP server with:
- Static file serving (HTML, CSS, JS)
- Token-guarded API endpoints
- File read/write operations
- Action endpoints (bootstrap, plugin switching, visibility toggle)

Security:
- Local-only bind (`127.0.0.1`)
- Per-session token
- CSP headers
- No remote access

API Endpoints:
```
GET  /api/state           # Full dashboard state
GET  /api/file?path=...   # Get managed file content
PUT  /api/file            # Update managed file
POST /api/action/*        # Execute operations
```

#### Static Files (`dashboard/static/`)

- `index.html` - Main dashboard UI
- `app.js` - Client-side logic
- `styles.css` - Styling

### 3. Scripts (`scripts/`)

| Script | Purpose |
|--------|---------|
| `bootstrap-home.sh` | Initialize environment, render instructions, sync paths |
| `show-capabilities.sh` | Display CLI status and capabilities |
| `render-instructions.mjs` | Regenerate instruction files |
| `set-codex-orchestrator.sh` | Switch Codex steering mode |
| `set-opencode-plugin.sh` | Switch OpenCode harness plugin |
| `set-global-superpowers-visibility.sh` | Toggle global superpowers |
| `update-opencode-config.mjs` | Guarded OpenCode config updates |
| `ensure-gemini-superpowers.mjs` | Link Gemini superpowers extension |

### 4. Source Files (`shared/`)

```
shared/
├── baseline-policy.md     # Common rules for all CLIs
└── overlays/
    ├── codex.md           # Codex-specific rules
    ├── claude.md          # Claude-specific rules
    ├── gemini.md          # Gemini-specific rules
    └── opencode.md        # OpenCode-specific rules
```

### 5. Generated Outputs (`generated/`)

Each generated file has this structure:

```markdown
<!-- GENERATED FILE. EDIT THE SOURCE LAYERS INSTEAD. -->
<!-- tool: {cli} -->
<!-- sources: shared/baseline-policy.md | shared/overlays/{cli}.md -->

[...composed content...]
```

## Data Flow

### Instruction Rendering Flow

```
1. User edits source file (baseline or overlay)
          │
          ▼
2. Dashboard PUT /api/file
          │
          ▼
3. lib/instructions.renderAllInstructions()
          │
          ├── Read baseline-policy.md
          ├── Read {cli}.md overlay
          ├── Concatenate with headers
          └── Write to generated/{cli}/ directory
          │
          ▼
4. Return rendered paths to dashboard
          │
          ▼
5. Home-level path points to generated file
```

### Dashboard State Building Flow

```
1. GET /api/state
          │
          ▼
2. lib/state.buildDashboardState()
          │
          ├── Scan home directories for CLIs
          ├── Read runtime configs (parse TOML/JSONC)
          ├── Detect plugins, extensions, skills
          ├── Evaluate profile status (managed/detected/broken)
          ├── List managed files
          └── Build capability lists
          │
          ▼
3. Return JSON state to dashboard
          │
          ▼
4. Dashboard UI renders profile cards
```

### Bootstrap Flow

```
1. User runs ./scripts/bootstrap-home.sh
          │
          ▼
2. Render all instruction files under generated/
          │
          ▼
3. Create direct home-path symlinks for Codex / Claude / Gemini
          │
          ▼
4. Update OpenCode config and link OpenCode instructions
          │
          ▼
5. Optionally use ais helpers when ais is installed
          │
          ▼
6. Optionally wire superpowers visibility / Gemini / Claude extras when available
          │
          ▼
7. Print bootstrap completion plus any warnings
```

## Profile Status Evaluation

Each CLI profile is evaluated to determine its status:

| Status | Meaning | Conditions |
|--------|---------|------------|
| `managed` | Hub-managed and aligned | Instructions synced and the represented workflow layer matches the hub-managed target |
| `detected` | Found, but not hub-managed | The CLI or its files were detected, but the machine is using a different, partial, or more minimal setup |
| `broken` | Unreadable or hard-failed | Config parse errors or other failures prevent reliable introspection |

Example (Codex):
```javascript
if (mode === "omx-primary") {
  return { status: "managed", summary: "Codex is managed in OMX-primary mode." };
}
if (!hasSuperpowers) {
  return { status: "detected", summary: "Codex is detected without the optional shared workflow layer." };
}
// ... more checks
```

## Orchestrator Modes (Codex)

The hub supports switching Codex's steering model:

| Mode | Behavior | When to Use |
|------|----------|-------------|
| `superpowers-primary` | Global superpowers drives steering | Default, for superpowers workflows |
| `omx-primary` | OMX/oh-my-codex controls AGENTS.md | When using OMX orchestration |
| `hybrid-tools-only` | Tools available, no steering claims | When you want tools without workflow claims |

## Extensibility

### Adding a New CLI

1. **Create overlay**: `shared/overlays/newcli.md`
2. **Add profile**: Edit `lib/hub-config.mjs` CLI_PROFILES
3. **Add evaluation**: Edit `lib/state.mjs` evaluateProfileStatus()
4. **Update delivery wiring**: Extend bootstrap/runtime helpers if the new CLI needs a managed home-path or config integration
5. **Test**: Run bootstrap and verify

### Adding a New Capability

Edit `lib/hub-config.mjs` KNOWN_CAPABILITIES:

```javascript
export const KNOWN_CAPABILITIES = {
  "my-new-skill": [
    "Capability description",
    "Another capability"
  ]
};
```

## Security Model

- **Local-only**: Dashboard binds to `127.0.0.1`, no remote access
- **Per-session tokens**: Random token generated each server start, injected into HTML
- **Origin checking**: API verifies requests come from dashboard origin
- **Guarded edits**: Runtime config changes are validated before applying
- **No secrets**: Dashboard state excludes API keys and sensitive data

## Persistence

- **Generated files**: Rendered locally under `generated/`
- **Home-level symlinks**: Created directly by `scripts/bootstrap-home.sh`
- **Systemd service**: Keeps dashboard running across reboots
- **Git tracking**: Repo can be committed to version control

## Dependencies

### Runtime

- Node.js 20+ (for dashboard server, scripts, and CI parity)
- Bash (for bootstrap scripts)
- Systemd (for persistent service, optional)
- `ais` binary (optional helper for extra home-registration integration)

### External CLIs (Optional)

- Codex CLI (`codex`)
- Claude Code (`claude`)
- Gemini CLI (`gemini`)
- OpenCode (`opencode`)
- Plus any other AI coding tools you use

## Limitations

1. **Hardcoded profiles**: Adding new CLIs requires code changes (see Extensibility)
2. **Platform-specific**: Systemd service is Linux-only; macOS/Windows need alternatives
3. **External plugins**: Hub can't fully control external plugin payloads
4. **Shared paths**: Some tools share paths (e.g., `~/.agents/skills/`), creating coupling
5. **Home directory assumption**: Assumes standard XDG config locations

## Future Directions

- Dynamic agent discovery (scan for config directories instead of hardcoding)
- Plugin system for adding new CLI support without code changes
- Multi-user support (currently single-user, local-only)
- Cloud sync for configurations
- Web-based first-run setup wizard

## References

- [Agent Discovery Documentation](AGENT_DISCOVERY.md) - Comprehensive list of AI coding tool config patterns
- [Configuration Examples](CONFIG_EXAMPLES.md) - Setup and customization guide
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions
