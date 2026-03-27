# Agent Rules Hub

![MIT License](https://img.shields.io/badge/license-MIT-22c55e)
![Supported CLIs](https://img.shields.io/badge/supported%20CLIs-4-3b82f6)
![Local First](https://img.shields.io/badge/local--first-127.0.0.1-a855f7)

> A local-first dashboard for discovering, inspecting, and editing the rule stack behind your AI coding CLIs.

Agent Rules Hub gives you one place to see the files that actually steer your agents: **rule files, generated instructions, runtime configs, and shared skill sources**.

**Supported today:** Codex, Claude Code, Gemini CLI, and OpenCode.

---

## Why this project is interesting

Most agent tooling helps you **sync** instructions.
Agent Rules Hub helps you **see the live setup**.

That means you can:

- discover common rule and skill files automatically
- inspect what each supported CLI is actually using
- edit text-backed sources from one local dashboard
- keep effective generated outputs visible without committing them
- manage the setup with an honest status model: **managed**, **detected**, or **broken**

If you use multiple AI coding CLIs, this turns scattered config into a single control plane.

---

## Screenshots

### Profiles overview

![Dashboard overview showing supported CLI health and delivery](docs/screenshots/dashboard-overview.png)

### Discovered files and editor

![Dashboard file editor showing discovered source files](docs/screenshots/dashboard-files.png)

### Guarded operations

![Dashboard operations panel for orchestrator and harness controls](docs/screenshots/dashboard-operations.png)

> These screenshots were captured from a clean local demo environment covering the 4 supported CLIs.

---

## What it does today

### Supported CLIs

| CLI | Discovery | Dashboard editing | Runtime awareness | Guarded actions |
| --- | --- | --- | --- | --- |
| **Codex** | Home rules, repo rules, shared skills, Codex-local skills | Yes | Config summary + orchestrator state | Yes |
| **Claude Code** | Home rules, repo rules, plugin visibility | Yes | Settings summary + plugin state | Indirect |
| **Gemini CLI** | Home rules, repo rules, extension visibility | Yes | Extension summary + source notes | Indirect |
| **OpenCode** | Home instructions, repo rules, config + plugin visibility | Yes | Config summary + harness state | Yes |

### Core capabilities

- **Discovery-first introspection**
  - current repo rule files
  - known home-level rule files
  - shared skill roots
  - Codex-local skills
  - Claude plugin visibility
  - Gemini extension visibility
  - OpenCode config + plugin visibility

- **Editable, text-backed sources**
  - shared baseline policy
  - per-CLI overlays
  - runtime config files
  - discovered rule files
  - discovered skill files

- **Generated instruction workflow**
  - baseline + overlay → generated instruction file
  - generated outputs stay visible in the dashboard

- **Local safety posture**
  - local-only bind on `127.0.0.1`
  - session-token API guard
  - edit surface restricted to discovered, allowed text files

### Honest scope

This project does **not** claim universal introspection for every agent ecosystem.

It is intentionally focused on the **4 supported CLIs above** and on **common, file-backed setup** that can be discovered and edited locally.

---

## Quick start

### Prerequisites

- Node.js 20+
- at least one of the supported CLIs if you want live per-CLI discovery beyond repo-local files
- optional for deeper wiring: `ais`, a `superpowers` checkout, Claude plugin access, Gemini CLI auth, or OpenCode plugin support

### 1) Clone the repo

```bash
git clone https://github.com/obdagli/agent-rules-hub.git
cd agent-rules-hub
```

### 2) Start the dashboard

```bash
npm run dashboard
```

Then open:

```text
http://127.0.0.1:4848
```

That is the fastest way to explore the dashboard without changing your home setup.

### 3) Optional: wire it into your home environment

If you want the repo to wire your home-level instruction files automatically, run:

```bash
./scripts/bootstrap-home.sh
```

What it does:

- regenerates `generated/` outputs locally
- creates direct home-path symlinks for Codex, Claude, Gemini, and OpenCode
- updates the OpenCode config to include the managed instructions path
- optionally layers in `ais`, Gemini extension setup, and Claude plugin setup when those tools are installed

This is optional for open-source users. The dashboard is still useful before full bootstrap, and missing optional integrations show up as runtime status gaps instead of blocking base discovery.

---

## Why it stands out

Agent Rules Hub is more than a folder of instruction files.

It combines:

- a **web dashboard** for a normally invisible layer of developer tooling
- a **discovery engine** for supported CLI rules, skills, and configs
- a **composition model** for shared baseline + CLI-specific overlays
- a **guarded editing surface** for local, text-backed setup

In one sentence:

> **Own your agent stack without manually hunting through config directories.**

---

## How discovery works

For the supported CLIs, the dashboard currently checks common locations such as:

- current repo rule files
- `~/AGENTS.md`
- `~/.codex/AGENTS.md`
- `~/.claude/CLAUDE.md`
- `~/.gemini/GEMINI.md`
- the OpenCode home instructions path
- `~/.agents/skills`
- `~/.codex/skills`
- managed `superpowers/skills`

The results are surfaced in:

- **Profiles** → active sources and delivery details
- **Files** → editable discovered files
- **Operations** → guarded local actions for supported CLIs

---

## Minimal mental model

```text
shared baseline + per-CLI overlays + runtime configs + discovered skill sources
                              ↓
                    generated instructions + dashboard state
                              ↓
                    one local control plane for 4 CLIs
```

---

## Repository layout

```text
agent-rules-hub/
├── shared/
│   ├── baseline-policy.md
│   └── overlays/
├── generated/
├── dashboard/
├── lib/
├── scripts/
├── tests/
└── docs/
```

Key areas:

- `shared/` — baseline rules + per-CLI overlays
- `dashboard/` — local web dashboard
- `lib/` — discovery, state building, composition, config helpers
- `scripts/` — bootstrap and guarded helper actions
- `tests/` — dashboard, discovery, and config coverage

---

## Useful commands

```bash
# Run the dashboard
npm run dashboard

# Regenerate effective instruction files
npm run render:instructions

# Run tests
npm test
```

Additional helper scripts:

| Script | Purpose |
| --- | --- |
| `scripts/bootstrap-home.sh` | Optional home-environment bootstrap |
| `scripts/render-instructions.mjs` | Regenerate managed instruction outputs |
| `scripts/set-codex-orchestrator.sh` | Switch Codex orchestration mode |
| `scripts/set-opencode-plugin.sh` | Switch OpenCode harness mode |
| `scripts/install-dashboard-service.sh` | Install the dashboard as a user service |

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Agent Discovery](docs/AGENT_DISCOVERY.md)
- [Configuration Examples](docs/CONFIG_EXAMPLES.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

---

## Contributing

Contributions are welcome.

Especially valuable contributions:

- stronger precedence modeling for discovered rule stacks
- better workspace/project discovery for the supported CLIs
- better cross-platform service/setup flows
- support for additional CLIs beyond the current 4

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

[MIT](LICENSE)
