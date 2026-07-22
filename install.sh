#!/usr/bin/env bash
set -euo pipefail

PACKAGE="@delta-infra/cli"
MIRRORS=(
  "https://registry.npmmirror.com"
  "https://registry.npmjs.org"
)

for registry in "${MIRRORS[@]}"; do
  echo "[delta-cli] Trying npm registry: $registry"
  if npm install -g "$PACKAGE" --registry="$registry"; then
    echo "[delta-cli] Installed successfully from $registry"
    exit 0
  fi
  echo "[delta-cli] Failed, trying next..."
done

echo "[delta-cli] All npm registries failed"
exit 1
