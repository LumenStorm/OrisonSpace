#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

show_menu() {
  echo ""
  echo "  Orison Space - 开发 & 构建"
  echo "  =========================="
  echo ""
  echo "  1) dev          启动桌面应用 (Electron + 热更新)"
  echo "  2) dev:server   单独启动后端服务"
  echo "  3) build        全量构建"
  echo "  4) build:desktop 构建桌面应用"
  echo "  5) build:server  构建服务端"
  echo "  6) test          运行全部测试"
  echo "  7) typecheck     类型检查"
  echo "  0) 退出"
  echo ""
}

run_choice() {
  case "$1" in
    1) pnpm dev ;;
    2) pnpm dev:server ;;
    3) pnpm build ;;
    4) pnpm build:desktop ;;
    5) pnpm build:server ;;
    6) pnpm test ;;
    7) pnpm typecheck ;;
    0) exit 0 ;;
    *) echo "  无效选项: $1" ;;
  esac
}

# 支持直接传参: ./run.sh 1
if [ -n "$1" ]; then
  run_choice "$1"
  exit $?
fi

# 交互菜单
while true; do
  show_menu
  read -rp "  请选择 [0-7]: " choice
  run_choice "$choice"
  echo ""
done
