# Shared Home Agent Baseline

This is the reusable home-level baseline for the 4 supported CLIs in Agent Rules Hub:

- Codex
- Claude Code
- Gemini CLI
- OpenCode

## Priority

- Direct user instructions override everything here.
- Repository-local instructions override this home-level baseline.
- Tool-specific plugins, skills, and harnesses should accelerate execution, not replace direct user intent.

## Scope

This baseline is intentionally generic.

It should stay safe to publish and reuse across machines. Do not assume:

- private workspace layouts
- personal memory-bank conventions
- internal proxy setups
- machine-specific services
- proprietary operational docs

If your environment needs those, layer them in outside this public baseline.

## Default Expectations

- Infer intent from the user request when the active CLI supports workflow routing.
- Be explicit about capability boundaries instead of pretending missing tools or skills exist.
- Prefer small, reversible changes over large speculative refactors.
- Verify before claiming completion.

## Git Hygiene

- Initialize git only when a project is clearly meant to be versioned.
- Do not push or publish unless explicitly asked.
- Avoid making branch assumptions when the repository already has local conventions.

## Control Plane Model

Agent Rules Hub manages:

- shared source layers in `shared/`
- per-CLI overlays in `shared/overlays/`
- runtime-generated effective instructions under `generated/`
- selected local runtime config files surfaced by the dashboard

Not everything active in a CLI is necessarily owned by this repo.
External plugins, shared skill directories, and harness internals may still exist outside the hub.
