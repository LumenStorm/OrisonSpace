#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

show_menu() {
  echo ""
  echo "  Orison Space"
  echo "  ============"
  echo ""
  echo "  1) dev           Agent + Server + Electron dev"
  echo "  2) dev:electron  Electron dev only"
  echo "  3) dev:server    Server dev only"
  echo "  4) dev:agent     Agent dev only"
  echo "  5) build         Build all"
  echo "  6) build:desktop Build desktop"
  echo "  7) build:server  Build server"
  echo "  8) test          Run tests"
  echo "  9) typecheck     Type check"
  echo "  0) exit"
  echo ""
}

kill_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
    if [ -n "$pids" ]; then
      echo "  Killing PID(s) $pids on port $port..."
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

run_choice() {
  case "$1" in
    1)
      kill_port 43117
      kill_port 18422
      (pnpm dev:agent) &
      (pnpm dev:server) &
      sleep 4
      pnpm dev
      ;;
    2) pnpm dev ;;
    3) kill_port 43117; pnpm dev:server ;;
    4) kill_port 18422; pnpm dev:agent ;;
    5) pnpm build ;;
    6) pnpm build:desktop ;;
    7) pnpm build:server ;;
    8) pnpm test ;;
    9) pnpm typecheck ;;
    0) exit 0 ;;
    *) echo "  Invalid: $1" ;;
  esac
}

if [ -n "$1" ]; then
  run_choice "$1"
  exit $?
fi

while true; do
  show_menu
  read -rp "  Select [0-9]: " choice
  run_choice "$choice"
  echo ""
done
