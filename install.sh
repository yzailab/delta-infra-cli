#!/usr/bin/env bash
#
# Install delta-cli on macOS / Linux.
#
# Behavior:
#   - If npm is available -> install the @delta-infra/cli npm package (preferred).
#   - Otherwise            -> pure curl + tar download from GitHub Release with
#                             mirror fallback (no Node.js/npm required).
#
# Usage:
#   ./install.sh                          # default install dir (~/.local/bin or ~/bin)
#   ./install.sh --dir "$HOME/.local/bin"
#   DELTA_CLI_VERSION=1.0.97 ./install.sh # pin a version
#
# Env overrides (same semantics as scripts/install.js):
#   DELTA_CLI_VERSION   pin version (default: latest GitHub release)
#   DELTA_CLI_MIRROR    force a single mirror (full-URL-prefix format)

set -euo pipefail

REPO="yzailab/delta-infra-cli"
BIN_NAME="delta-cli"
INSTALL_DIR=""

# Mirror prefix format matches scripts/install.js: https://<mirror>/https://github.com/...
MIRRORS=(
  "https://gh.ddlc.top"
  "https://ghproxy.net"
  "https://gh-proxy.com"
)

say()  { echo "[delta-cli] $*"; }
die()  { echo "[delta-cli] ERROR: $*" >&2; exit 1; }

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)
      INSTALL_DIR="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--dir <install_dir>]"; exit 0 ;;
    *)
      die "Unknown argument: $1" ;;
  esac
done

# ── 1. Prefer npm when available ────────────────────────────────────────────
if command -v npm >/dev/null 2>&1; then
  PACKAGE="@delta-infra/cli"
  REGISTRIES=(
    "https://registry.npmmirror.com"
    "https://registry.npmjs.org"
  )
  for reg in "${REGISTRIES[@]}"; do
    say "Detected npm; installing $PACKAGE from $reg..."
    if npm install -g "$PACKAGE" --registry="$reg"; then
      say "Installed successfully from $reg"
      exit 0
    fi
    say "Failed, trying next registry..."
  done
  say "npm install failed; falling back to direct binary download."
else
  say "npm not found; using direct binary download (no Node.js required)."
fi

# ── 2. Detect OS + arch ─────────────────────────────────────────────────────
UNAME_S="$(uname -s)"
case "$UNAME_S" in
  Linux*)  PLATFORM="linux" ;;
  Darwin*) PLATFORM="darwin" ;;
  MINGW*|MSYS*|CYGWIN*)
    # Git Bash / MSYS on Windows. Use install.ps1 instead.
    die "Detected Windows shell ($UNAME_S). On Windows, use install.ps1."
    ;;
  *)       die "Unsupported OS: $UNAME_S" ;;
esac

case "$(uname -m)" in
  x86_64|amd64) ARCH="amd64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *) die "Unsupported arch: $(uname -m)" ;;
esac

# Default install dir
if [[ -z "$INSTALL_DIR" ]]; then
  if [[ -n "${HOME:-}" && -w "${HOME}" ]]; then
    INSTALL_DIR="${HOME}/.local/bin"
    [[ -d "${HOME}/.local/bin" ]] || INSTALL_DIR="${HOME}/bin"
  else
    die "Cannot determine install dir; pass --dir"
  fi
fi

# ── 3. Resolve version ──────────────────────────────────────────────────────
VERSION="${DELTA_CLI_VERSION:-}"
if [[ -z "$VERSION" ]]; then
  say "Resolving latest version from GitHub..."
  if command -v curl >/dev/null 2>&1; then
    LATEST_JSON="$(curl -fsSL --connect-timeout 10 --max-time 30 "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null || true)"
    VERSION="$(echo "$LATEST_JSON" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"v\?\([^"]*\)".*/\1/p' | head -n1)"
  fi
  if [[ -z "$VERSION" ]]; then
    die "Could not resolve latest version (network issue?). Set DELTA_CLI_VERSION to pin one."
  fi
fi
VERSION="${VERSION#v}"

# ── 4. Build download URLs (mirrors first, then GitHub) ─────────────────────
ARCHIVE_NAME="delta-cli-${PLATFORM}-${ARCH}.tar.gz"
REL_PATH="releases/download/v${VERSION}/${ARCHIVE_NAME}"
GITHUB_URL="https://github.com/${REPO}/${REL_PATH}"
declare -a URLS=()
for mirror in "${MIRRORS[@]}"; do
  URLS+=("${mirror}/https://github.com/${REPO}/${REL_PATH}")
done
URLS+=("$GITHUB_URL")
if [[ -n "${DELTA_CLI_MIRROR:-}" ]]; then
  URLS=("${DELTA_CLI_MIRROR%/}/https://github.com/${REPO}/${REL_PATH}" "${URLS[@]}")
fi

# ── 5. Download ─────────────────────────────────────────────────────────────
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
ARCHIVE_PATH="${TMP_DIR}/${ARCHIVE_NAME}"

DOWNLOADED=0
for url in "${URLS[@]}"; do
  say "Downloading from ${url}"
  if curl -fSL --connect-timeout 10 --max-time 120 --speed-limit 50000 --speed-time 10 --output "$ARCHIVE_PATH" "$url" 2>/dev/null; then
    DOWNLOADED=1
    break
  fi
  say "Failed, trying next source..."
done
if [[ "$DOWNLOADED" -ne 1 ]]; then
  die "Failed to download delta-cli from all sources."
fi

# ── 6. Verify SHA-256 against checksums.txt ─────────────────────────────────
say "Verifying SHA-256 checksum..."
CHECKSUM_URL="https://github.com/${REPO}/releases/download/v${VERSION}/checksums.txt"
if CHECKSUMS="$(curl -fsSL --connect-timeout 10 --max-time 30 "$CHECKSUM_URL" 2>/dev/null || true)"; then
  EXPECTED="$(echo "$CHECKSUMS" | awk -v a="$ARCHIVE_NAME" '$0 ~ ("(^| )" a "( |$)") { print $1; exit }')"
  if [[ -n "$EXPECTED" ]]; then
    if command -v sha256sum >/dev/null 2>&1; then
      ACTUAL="$(sha256sum "$ARCHIVE_PATH" | awk '{print $1}')"
    elif command -v shasum >/dev/null 2>&1; then  # macOS
      ACTUAL="$(shasum -a 256 "$ARCHIVE_PATH" | awk '{print $1}')"
    else
      say "[WARN] No sha256 tool; skipping checksum verification."
      EXPECTED=""
    fi
    if [[ -n "$EXPECTED" && "$ACTUAL" != "$EXPECTED" ]]; then
      die "Checksum mismatch! expected $EXPECTED, got $ACTUAL"
    fi
    say "Checksum verified."
  else
    say "[WARN] No checksum entry for $ARCHIVE_NAME; skipping verification."
  fi
else
  say "[WARN] Could not fetch checksums.txt; skipping verification."
fi

# ── 7. Extract ──────────────────────────────────────────────────────────────
say "Extracting archive..."
tar -xzf "$ARCHIVE_PATH" -C "$TMP_DIR"

# ── 8. Locate binary and install ────────────────────────────────────────────
BIN_SRC="$(find "$TMP_DIR" -type f -name "$BIN_NAME" | head -n1)"
if [[ -z "$BIN_SRC" ]]; then
  # Some releases use the delta-cli-<os>-<arch> name inside the tarball
  BIN_SRC="$(find "$TMP_DIR" -type f -name "delta-cli-${PLATFORM}-${ARCH}" | head -n1)"
fi
if [[ -z "$BIN_SRC" ]]; then
  die "Binary not found in extracted archive."
fi

mkdir -p "$INSTALL_DIR"
BIN_DEST="${INSTALL_DIR}/${BIN_NAME}"
install -m 0755 "$BIN_SRC" "$BIN_DEST"

# ── 9. Add to PATH if not present ───────────────────────────────────────────
if ! echo ":$PATH:" | grep -q ":${INSTALL_DIR}:"; then
  case "$(basename "$SHELL")" in
    zsh)  RC_FILE="${HOME}/.zshrc" ;;
    bash) RC_FILE="${HOME}/.bashrc" ;;
    *)    RC_FILE="${HOME}/.profile" ;;
  esac
  if ! grep -q "export PATH=.*${INSTALL_DIR}" "$RC_FILE" 2>/dev/null; then
    {
      echo ""
      echo "# added by delta-cli installer"
      echo "export PATH=\"${INSTALL_DIR}:\$PATH\""
    } >> "$RC_FILE"
    say "Added ${INSTALL_DIR} to PATH in ${RC_FILE}"
    say "Run 'source ${RC_FILE}' or restart your terminal to use '${BIN_NAME}'."
  fi
else
  say "${INSTALL_DIR} is already in PATH."
fi

say "Installed successfully: ${BIN_DEST}"
export PATH="${INSTALL_DIR}:${PATH}"
"$BIN_DEST" --version
