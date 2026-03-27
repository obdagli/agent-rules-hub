#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
unit_source="$repo_root/systemd/agent-rules-hub-dashboard.service"
unit_target_dir="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
unit_target="$unit_target_dir/agent-rules-hub-dashboard.service"
npm_bin="$(command -v npm)"

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing required command: $cmd" >&2
    exit 1
  fi
}

escape_sed_replacement() {
  printf '%s' "$1" | sed 's/[&|]/\\&/g'
}

require_cmd npm
require_cmd systemctl

mkdir -p "$unit_target_dir"
sed \
  -e "s|__REPO_ROOT__|$(escape_sed_replacement "$repo_root")|g" \
  -e "s|__NPM_BIN__|$(escape_sed_replacement "$npm_bin")|g" \
  "$unit_source" > "$unit_target"

systemctl --user daemon-reload
systemctl --user enable --now agent-rules-hub-dashboard.service
systemctl --user restart agent-rules-hub-dashboard.service

echo "installed and started agent-rules-hub-dashboard.service"
