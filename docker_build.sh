#!/usr/bin/env bash
set -euo pipefail

cd /usr/src/myapp
mkdir -p bin

# Running as root inside Docker on a host-owned repository triggers
# git's "dubious ownership" check. Mark the build directory as safe so
# git describe can inject the correct version into the binary.
git config --global --add safe.directory /usr/src/myapp

VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

LDFLAGS="-X github.com/delta-infra/delta-infra-cli/internal/build.Version=${VERSION} -X github.com/delta-infra/delta-infra-cli/internal/build.Commit=${COMMIT} -X github.com/delta-infra/delta-infra-cli/internal/build.Date=${DATE}"

echo "Building delta-cli-darwin-amd64 ..."
CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -buildvcs=false -ldflags "${LDFLAGS}" -o bin/delta-cli-darwin-amd64 ./cmd/delta-cli

echo "Building delta-cli-darwin-arm64 ..."
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -buildvcs=false -ldflags "${LDFLAGS}" -o bin/delta-cli-darwin-arm64 ./cmd/delta-cli

echo "Building delta-cli-linux-amd64 ..."
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -buildvcs=false -ldflags "${LDFLAGS}" -o bin/delta-cli-linux-amd64 ./cmd/delta-cli

echo "Building delta-cli-windows-amd64.exe ..."
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -buildvcs=false -ldflags "${LDFLAGS}" -o bin/delta-cli-windows-amd64.exe ./cmd/delta-cli

echo "Done."
ls -la bin/
