#!/bin/bash
# Symlink .env files from ~/.cliclaw/env/ into this worktree.
# Run from repo root: ./scripts/setup-env.sh

set -e

ENV_DIR="$HOME/.cliclaw/env"

if [ ! -d "$ENV_DIR" ]; then
  echo "Error: $ENV_DIR does not exist. Create it with your .env files first."
  exit 1
fi

link_env() {
  local app="$1"
  local env_file="$ENV_DIR/${app}.env"
  local target="apps/${app}/.env"

  if [ ! -f "$env_file" ]; then
    echo "  skip: $env_file not found"
    return
  fi

  if [ -L "$target" ]; then
    echo "  ok:   $target (already symlinked)"
    return
  fi

  if [ -f "$target" ]; then
    echo "  warn: $target exists as regular file, replacing with symlink"
    rm "$target"
  fi

  ln -s "$env_file" "$target"
  echo "  done: $target -> $env_file"
}

echo "Linking .env files..."
link_env "dashboard"
link_env "portal"
echo "Done."
