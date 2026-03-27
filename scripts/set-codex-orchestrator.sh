#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
hub_agents_path="$repo_root/generated/codex/AGENTS.md"
home_agents_path="$HOME/.codex/AGENTS.md"
mode_file="$HOME/.codex/.agent-rules-hub-codex-orchestrator-mode"
global_visibility_script="$repo_root/scripts/set-global-superpowers-visibility.sh"
backup_root="$HOME/.codex/.agent-rules-hub-backups/codex-orchestrator"

usage() {
  echo "usage: $0 {superpowers-primary|omx-primary|hybrid-tools-only|status}" >&2
  exit 1
}

backup_home_agents() {
  if [ -L "$home_agents_path" ] || [ -f "$home_agents_path" ]; then
    local stamp
    stamp="$(date +%Y%m%d-%H%M%S)"
    local backup_dir="$backup_root/$stamp"
    mkdir -p "$backup_dir"
    cp -a "$home_agents_path" "$backup_dir/AGENTS.md"
  fi
}

write_mode() {
  mkdir -p "$(dirname "$mode_file")"
  printf '%s\n' "$1" > "$mode_file"
}

infer_mode() {
  if [ -f "$mode_file" ]; then
    local saved
    saved="$(tr -d '\r\n' < "$mode_file")"
    case "$saved" in
      superpowers-primary|omx-primary|hybrid-tools-only)
        echo "$saved"
        return 0
        ;;
    esac
  fi

  if [ -f "$home_agents_path" ] && grep -q "oh-my-codex" "$home_agents_path"; then
    echo "omx-primary"
    return 0
  fi

  local resolved_home=""
  if resolved_home="$(readlink -f "$home_agents_path" 2>/dev/null)"; then
    if [ "$resolved_home" = "$hub_agents_path" ]; then
      if [ "$("$global_visibility_script" status)" = "on" ]; then
        echo "superpowers-primary"
      else
        echo "hybrid-tools-only"
      fi
      return 0
    fi
  fi

  echo "custom"
}

ensure_hub_agents() {
  mkdir -p "$(dirname "$home_agents_path")"
  ln -sfn "$hub_agents_path" "$home_agents_path"
}

case "$mode" in
  status)
    infer_mode
    ;;
  superpowers-primary)
    backup_home_agents
    ensure_hub_agents
    bash "$global_visibility_script" on >/dev/null
    write_mode "$mode"
    echo "codex orchestrator: superpowers-primary"
    ;;
  hybrid-tools-only)
    backup_home_agents
    ensure_hub_agents
    write_mode "$mode"
    echo "codex orchestrator: hybrid-tools-only"
    ;;
  omx-primary)
    if ! command -v omx >/dev/null 2>&1; then
      echo "missing required command: omx" >&2
      exit 1
    fi
    backup_home_agents
    printf 'n\n' | omx setup --scope user --skill-target codex-home --force >/dev/null
    write_mode "$mode"
    echo "codex orchestrator: omx-primary"
    ;;
  *)
    usage
    ;;
esac
