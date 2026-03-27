#!/usr/bin/env bash
set -euo pipefail

xdg_config_home="${XDG_CONFIG_HOME:-$HOME/.config}"
config="${OPENCODE_CONFIG:-$xdg_config_home/opencode/opencode.jsonc}"
mode="${1:-}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  echo "usage: $0 {oh-my-opencode|none}" >&2
  exit 1
}

[ -f "$config" ] || { echo "missing config: $config" >&2; exit 1; }

case "$mode" in
  oh-my-opencode|none)
    ;;
  *)
    usage
    ;;
esac

node "$repo_root/scripts/update-opencode-config.mjs" \
  --config "$config" \
  --plugin-mode "$mode"
