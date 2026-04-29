#!/usr/bin/env bash
set -euo pipefail
PORT="${MCP_PORT:-8080}"
exec cloudflared tunnel --url "http://127.0.0.1:${PORT}"
