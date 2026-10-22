@echo off
REM ==========================================================
REM  GeoGuessr Overlay - FIRST TIME SETUP
REM  Installs dependencies and the Electron runtime.
REM  Run this once, before 2_START_OVERLAY.bat
REM ==========================================================
echo ==========================================================
echo   GeoGuessr Overlay - First Time Setup
echo ==========================================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js was not found on this computer.
  echo     Install it from https://nodejs.org/ ^(version 18 or newer^)
  echo     then run this file again.
  echo.
  pause
  exit /b 1
)

echo [1/2] Installing dependencies. This can take a couple of minutes...
call npm install

echo.
echo [2/2] Verifying the Electron runtime...
REM npm install can exit 0 even when the Electron binary download fails,
REM so the real check is whether Electron can resolve its own path.
call node -e "require('electron')" >nul 2>&1
if errorlevel 1 (
  echo     Electron runtime not found - repairing...
  echo.
  if exist "node_modules\electron" rmdir /s /q "node_modules\electron"
  call npm install electron --save-dev
  call node -e "require('electron')" >nul 2>&1
  if errorlevel 1 (
    echo.
    echo [X] Could not download the Electron runtime.
    echo     This step downloads ~100 MB from GitHub releases.
    echo     - Check your internet connection
    echo     - If you use a firewall/proxy, allow github.com
    echo     - Corporate networks sometimes block it; try again later
    echo.
    pause
    exit /b 1
  )
)

echo.
echo ==========================================================
echo   Setup complete!
echo   Now run  2_START_OVERLAY.bat  to play
echo ==========================================================
echo.
pause
