# Agent Rules Hub Architecture

This document describes the architecture and design of Agent Rules Hub, a local introspection and delivery workspace for supported AI coding CLI configurations.

## Overview

Agent Rules Hub solves the problem of understanding and wiring instruction delivery across supported AI coding CLIs. It provides:

- **Centralized rule management** - Edit baseline rules and per-CLI overlays in one place
- **Instruction composition** - Combine baseline + overlays into generated instruction files
- **Runtime awareness** - Track what is hub-wired vs externally installed
- **Live dashboard** - Web UI for inspection and guarded local actions
- **Multi-CLI support** - Supports Codex, Claude Code, Gemini CLI, and OpenCode today; adding more CLIs requires code, tests, and docs updates

## Core Concepts

### Dashboard UX Model

The dashboard is the primary product surface for this repo. Its interaction model is intentionally split into four sections plus two top-level actions:

- **Profiles** — compare the live delivery state of Codex, Claude Code, Gemini CLI, and OpenCode
- **Files** — inspect or edit the discovered text-backed sources the hub is allowed to surface
- **Bench** — keep prompt recipes and capability checks close to the runtime state they are meant to evaluate
- **Operations** — run guarded local actions instead of hand-editing orchestration or plugin-profile wiring

Top-level hero actions:

- **Refresh Snapshot** — non-destructive re-discovery of local files, skills, configs, and profile state
- **Run Bootstrap** — mutating setup action that wires the repo into the supported home-level instruction paths

This split is important: the hub is meant to feel like a local workspace, not a documentation site with an editor bolted on.

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

The hub is explicit about what it controls:

| Category | Description | Examples |
|----------|-------------|----------|
| **Hub-Managed** | Fully controlled by this repo | Source overlays, generated outputs, selected runtime configs |
| **External** | Outside hub control | Claude plugin payloads, OpenCode plugin internals, system skills |

### Delivery Models

Each CLI has a different instruction delivery model:

| CLI | Home Path | Generated File | Runtime Config | External Dependency |
|-----|-----------|----------------|----------------|---------------------|
| Codex | `~/.codex/AGENTS.md` | `generated/codex/AGENTS.md` | `~/.codex/config.toml` | Global skills at `~/.agents/skills/` |
| Claude | `~/.claude/CLAUDE.md` | `generated/claude/CLAUDE.md` | `~/.claude/settings.json` | Observed plugin state (external lifecycle) |
| Gemini | `~/.gemini/GEMINI.md` | `generated/gemini/GEMINI.md` | No dedicated dashboard-editable runtime config file today | Observed extension state (external lifecycle) |
| OpenCode | `~/.config/opencode/default-instructions.md` | `generated/opencode/default-instructions.md` | `~/.config/opencode/opencode.jsonc` | Optional plugin profile from config (packages external) |

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
| `set-codex-orchestrator.sh` | Switch Codex orchestrator mode |
| `set-opencode-plugin.sh` | Switch OpenCode plugin profile |
| `set-global-superpowers-visibility.sh` | Toggle shared ~/.agents/skills discovery |
| `update-opencode-config.mjs` | Guarded OpenCode config updates |

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
1. User clicks **Run Bootstrap** in the dashboard or runs `./scripts/bootstrap-home.sh`
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
6. Print bootstrap completion plus any warnings
```

## Profile Status Evaluation

Each CLI profile is evaluated to determine its status:

| Status | Meaning | Conditions |
|--------|---------|------------|
| `managed` | Delivery wired to hub | Instruction path is synced to this repo; plugin/extension layers are reported as observed runtime state |
| `detected` | Found, but not wired | The CLI exists but the instruction path is not currently wired to this repo |
| `broken` | Unreadable or hard-failed | Config parse errors or other failures prevent reliable introspection |

Example (Codex):
```javascript
if (mode === "omx-primary") {
  return { status: "managed", summary: "Codex instruction delivery is managed in OMX mode." };
}
if (!syncOk) {
  return { status: "detected", summary: "Codex is detected but not wired to hub delivery." };
}
// plugin/skill layers remain observed runtime state
```

## Orchestrator Modes (Codex)

The hub supports switching Codex orchestrator mode:

| Mode | Behavior | When to Use |
|------|----------|-------------|
| `omx-primary` | OMX/oh-my-codex manages AGENTS.md wiring | When using OMX orchestration |
| `hybrid-tools-only` | Hub-managed AGENTS delivery with no steering claims | Recommended default |

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
