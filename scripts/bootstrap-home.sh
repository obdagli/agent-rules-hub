#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ais_bin="${AIS_BIN:-$HOME/.local/bin/ais}"
xdg_config_home="${XDG_CONFIG_HOME:-$HOME/.config}"
workspace_root="${WORKSPACE_ROOT:-$HOME/workspace}"
opencode_config="${OPENCODE_CONFIG:-$xdg_config_home/opencode/opencode.jsonc}"
opencode_instructions="${OPENCODE_INSTRUCTIONS_PATH:-$xdg_config_home/opencode/default-instructions.md}"
render_script="$repo_root/scripts/render-instructions.mjs"
update_opencode_script="$repo_root/scripts/update-opencode-config.mjs"
ensure_gemini_script="$repo_root/scripts/ensure-gemini-superpowers.mjs"
warnings=()

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing required command: $cmd" >&2
    exit 1
  fi
}

have_cmd() {
  local cmd="$1"
  if [ -x "$cmd" ]; then
    return 0
  fi

  command -v "$cmd" >/dev/null 2>&1
}

warn() {
  local message="$1"
  warnings+=("$message")
  echo "warning: $message" >&2
}

ensure_symlink() {
  local source="$1"
  local target="$2"
  mkdir -p "$(dirname "$target")"
  ln -sfn "$source" "$target"
}

detect_superpowers_root() {
  local configured_root="${SUPERPOWERS_ROOT:-}"
  if [ -n "$configured_root" ]; then
    if [ -d "$configured_root" ]; then
      printf '%s\n' "$configured_root"
      return 0
    fi

    return 1
  fi

  local candidates=(
    "$workspace_root/superpowers"
    "$HOME/workspace/superpowers"
    "$repo_root/../superpowers"
  )

  for candidate in "${candidates[@]}"; do
    if [ -d "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

require_cmd node

node "$render_script" >/dev/null

ensure_symlink "$repo_root/generated/codex/AGENTS.md" "$HOME/.codex/AGENTS.md"
ensure_symlink "$repo_root/generated/claude/CLAUDE.md" "$HOME/.claude/CLAUDE.md"
ensure_symlink "$repo_root/generated/gemini/GEMINI.md" "$HOME/.gemini/GEMINI.md"

node "$update_opencode_script" \
  --config "$opencode_config" \
  --ensure-instruction-path "$opencode_instructions" >/dev/null

ensure_symlink "$repo_root/generated/opencode/default-instructions.md" "$opencode_instructions"

if have_cmd "$ais_bin"; then
  "$ais_bin" use "$repo_root" >/dev/null || warn "ais could not register the repo checkout."
  "$ais_bin" codex md add AGENTS --user >/dev/null 2>&1 || warn "ais could not add the Codex home markdown registration."
  "$ais_bin" claude md add CLAUDE --user >/dev/null 2>&1 || warn "ais could not add the Claude home markdown registration."
  "$ais_bin" gemini md add GEMINI --user >/dev/null 2>&1 || warn "ais could not add the Gemini home markdown registration."
  "$ais_bin" user install >/dev/null || warn "ais user install did not complete successfully."
else
  warn "ais is not installed; direct symlinks were created for Codex, Claude, and Gemini instead."
fi

superpowers_root=""
if superpowers_root="$(detect_superpowers_root)"; then
  if [ "$("$repo_root/scripts/set-global-superpowers-visibility.sh" status)" = "on" ]; then
    ensure_symlink "$superpowers_root/skills" "$HOME/.agents/skills/superpowers"
  fi

  if command -v gemini >/dev/null 2>&1; then
    node "$ensure_gemini_script" "$superpowers_root" >/dev/null || warn "Gemini superpowers linking did not complete successfully."
  fi

  if command -v claude >/dev/null 2>&1; then
    if ! claude plugins list 2>/dev/null | grep -q 'superpowers@claude-plugins-official'; then
      claude plugins install superpowers@claude-plugins-official --scope user || warn "Claude plugin install did not complete successfully."
    fi
  fi
else
  warn "superpowers checkout was not found; skipping shared skill wiring and Gemini/Claude superpowers setup."
fi

echo "bootstrap complete"
if [ "${#warnings[@]}" -gt 0 ]; then
  printf 'bootstrap warnings (%s):\n' "${#warnings[@]}" >&2
  for message in "${warnings[@]}"; do
    printf -- '- %s\n' "$message" >&2
  done
fi
