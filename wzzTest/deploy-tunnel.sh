#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
export PATH="${REPO_ROOT}/.local/bin:${PATH}"
PORT="${MCP_PORT:-8080}"
exec cloudflared tunnel --url "http://127.0.0.1:${PORT}"
