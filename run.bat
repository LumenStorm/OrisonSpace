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
echo   1  dev           (Server + Electron dev)
echo   2  dev:electron  (Electron dev only)
echo   3  dev:server    (Server dev only)
echo   4  build         (Build all)
echo   5  build:desktop (Build desktop)
echo   6  build:server  (Build server)
echo   7  test          (Run tests)
echo   8  typecheck     (Type check)
echo   0  exit
echo.
set "choice="
set /p choice="  Select [0-8]: "

:runchoice
if "%choice%"=="0" exit /b 0
if "%choice%"=="1" ( call :killport 4000 && start "OrisonServer" cmd /c "pnpm dev:server" && ping -n 3 127.0.0.1 >nul && pnpm dev && goto done )
if "%choice%"=="2" ( pnpm dev && goto done )
if "%choice%"=="3" ( call :killport 4000 && pnpm dev:server && goto done )
if "%choice%"=="4" ( pnpm build && goto done )
if "%choice%"=="5" ( pnpm build:desktop && goto done )
if "%choice%"=="6" ( pnpm build:server && goto done )
if "%choice%"=="7" ( pnpm test && goto done )
if "%choice%"=="8" ( pnpm typecheck && goto done )

echo   Invalid: %choice%

:done
echo.
if not "%1"=="" ( pause && exit /b )
pause
goto menu

:killport
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":%~1 " ^| findstr "LISTENING"') do (
    echo   Killing PID %%p on port %~1...
    taskkill /F /PID %%p >nul 2>&1
)
exit /b 0
