#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"
link_path="$HOME/.agents/skills/superpowers"
disabled_path="$HOME/.agents/skills/.superpowers.disabled"
workspace_root="${WORKSPACE_ROOT:-$HOME/workspace}"
source_root="${SUPERPOWERS_ROOT:-}"

usage() {
  echo "usage: $0 {on|off|status}" >&2
  exit 1
}

if [ -z "$source_root" ]; then
  for candidate in \
    "$workspace_root/superpowers" \
    "$HOME/workspace/superpowers" \
    "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/../superpowers"; do
    if [ -d "$candidate/skills" ]; then
      source_root="$candidate"
      break
    fi
  done
fi

source_path="${source_root:-$workspace_root/superpowers}/skills"

mkdir -p "$(dirname "$link_path")"

case "$mode" in
  on)
    rm -rf "$disabled_path"
    ln -sfn "$source_path" "$link_path"
    echo "global superpowers visibility: on"
    ;;
  off)
    if [ -L "$link_path" ] || [ -e "$link_path" ]; then
      rm -rf "$link_path"
    fi
    mkdir -p "$disabled_path"
    echo "global superpowers visibility: off"
    ;;
  status)
    if [ -L "$link_path" ] || [ -d "$link_path" ]; then
      echo "on"
    else
      echo "off"
    fi
    ;;
  *)
    usage
    ;;
esac
