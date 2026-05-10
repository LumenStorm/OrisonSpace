@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
set "ELECTRON_RUN_AS_NODE="

if not "%1"=="" (
    set "choice=%1"
    goto runchoice
)

:menu
echo.
echo   Orison Space
echo   ============
echo.
echo   1  dev           (Agent + Server + Electron dev)
echo   2  dev:electron  (Electron dev only)
echo   3  dev:server    (Server dev only)
echo   4  dev:agent     (Agent dev only)
echo   5  build         (Build all)
echo   6  build:desktop (Build desktop)
echo   7  build:server  (Build server)
echo   8  test          (Run tests)
echo   9  typecheck     (Type check)
echo   0  exit
echo.
set "choice="
set /p choice="  Select [0-9]: "

:runchoice
if "%choice%"=="0" exit /b 0
if "%choice%"=="1" goto dev_all
if "%choice%"=="2" goto dev_electron
if "%choice%"=="3" goto dev_server
if "%choice%"=="4" goto dev_agent
if "%choice%"=="5" goto build_all
if "%choice%"=="6" goto build_desktop
if "%choice%"=="7" goto build_server
if "%choice%"=="8" goto run_tests
if "%choice%"=="9" goto run_typecheck

echo   Invalid: %choice%
goto done

:done
echo.
if not "%1"=="" ( pause && exit /b )
pause
goto menu

:dev_all
call :killport 4000
call :killport 18422
start "OrisonAgent" powershell -NoExit -NoProfile -ExecutionPolicy Bypass -Command "Set-Location -LiteralPath '%~dp0'; Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue; pnpm dev:agent"
start "OrisonServer" powershell -NoExit -NoProfile -ExecutionPolicy Bypass -Command "Set-Location -LiteralPath '%~dp0'; Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue; pnpm dev:server"
ping -n 5 127.0.0.1 >nul
call :runpnpm dev
goto done

:dev_electron
call :runpnpm dev
goto done

:dev_server
call :killport 4000
call :runpnpm dev:server
goto done

:dev_agent
call :killport 18422
call :runpnpm dev:agent
goto done

:build_all
call :runpnpm build
goto done

:build_desktop
call :runpnpm build:desktop
goto done

:build_server
call :runpnpm build:server
goto done

:run_tests
call :runpnpm test
goto done

:run_typecheck
call :runpnpm typecheck
goto done

:runpnpm
powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location -LiteralPath '%~dp0'; Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue; pnpm %~1"
exit /b %errorlevel%

:killport
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":%~1 " ^| findstr "LISTENING"') do (
    echo   Killing PID %%p on port %~1...
    taskkill /F /PID %%p >nul 2>&1
)
exit /b 0
