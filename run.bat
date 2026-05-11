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
if "%choice%"=="1" goto devall
if "%choice%"=="2" goto develectron
if "%choice%"=="3" goto devserver
if "%choice%"=="4" goto devagent
if "%choice%"=="5" goto buildall
if "%choice%"=="6" goto builddesktop
if "%choice%"=="7" goto buildserver
if "%choice%"=="8" goto testall
if "%choice%"=="9" goto typecheck

echo   Invalid: %choice%
goto done

:devall
call :killport 43117
call :killport 18422
start "OrisonAgent" /D "%~dp0" cmd /k "pnpm dev:agent"
start "OrisonServer" /D "%~dp0" cmd /k "pnpm dev:server"
ping -n 5 127.0.0.1 >nul
pnpm dev
goto done

:develectron
pnpm dev
goto done

:devserver
call :killport 43117
pnpm dev:server
goto done

:devagent
call :killport 18422
pnpm dev:agent
goto done

:buildall
pnpm build
goto done

:builddesktop
pnpm build:desktop
goto done

:buildserver
pnpm build:server
goto done

:testall
pnpm test
goto done

:typecheck
pnpm typecheck
goto done

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
