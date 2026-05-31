#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

show_menu() {
  echo ""
  echo "  Orison Space"
  echo "  ============"
  echo ""
  echo "  1) dev           Electron dev"
  echo "  2) build         Build all"
  echo "  3) build:desktop Build desktop"
  echo "  4) test          Run tests"
  echo "  5) typecheck     Type check"
  echo "  0) exit"
  echo ""
}

run_choice() {
  case "$1" in
    1) pnpm dev ;;
    2) pnpm build ;;
    3) pnpm build:desktop ;;
    4) pnpm test ;;
    5) pnpm typecheck ;;
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
  read -rp "  Select [0-5]: " choice
  run_choice "$choice"
  echo ""
done
