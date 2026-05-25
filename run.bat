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
echo   2  build         (Build all)
echo   3  build:desktop (Build desktop)
echo   4  test          (Run tests)
echo   5  typecheck     (Type check)
echo   0  exit
echo.
set "choice="
set /p choice="  Select [0-5]: "

:runchoice
if "%choice%"=="0" exit /b 0
if "%choice%"=="1" goto develectron
if "%choice%"=="2" goto buildall
if "%choice%"=="3" goto builddesktop
if "%choice%"=="4" goto testall
if "%choice%"=="5" goto typecheck

echo   Invalid: %choice%
goto done

:develectron
pnpm dev
goto done

:buildall
pnpm build
goto done

:builddesktop
pnpm build:desktop
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
