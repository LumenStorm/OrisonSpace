@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

if not "%1"=="" (
    set "choice=%1"
    goto runchoice
)

:menu
echo.
echo   Orison Space
echo   ============
echo.
echo   1  dev           (Electron dev)
echo   2  dev:server    (Server dev)
echo   3  build         (Build all)
echo   4  build:desktop (Build desktop)
echo   5  build:server  (Build server)
echo   6  test          (Run tests)
echo   7  typecheck     (Type check)
echo   0  exit
echo.
set "choice="
set /p choice="  Select [0-7]: "

:runchoice
if "%choice%"=="0" exit /b 0
if "%choice%"=="1" ( pnpm dev && goto done )
if "%choice%"=="2" ( pnpm dev:server && goto done )
if "%choice%"=="3" ( pnpm build && goto done )
if "%choice%"=="4" ( pnpm build:desktop && goto done )
if "%choice%"=="5" ( pnpm build:server && goto done )
if "%choice%"=="6" ( pnpm test && goto done )
if "%choice%"=="7" ( pnpm typecheck && goto done )

echo   Invalid: %choice%

:done
echo.
if not "%1"=="" ( pause && exit /b )
pause
goto menu
