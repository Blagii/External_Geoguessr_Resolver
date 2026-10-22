@echo off
REM ==========================================================
REM  GeoGuessr Overlay - FIRST TIME SETUP
REM  Downloads the Electron runtime (once). Run this the first
REM  time only, before 2_START_OVERLAY.bat
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
if errorlevel 1 (
  echo.
  echo [X] Installation failed. Check your internet connection and retry.
  echo.
  pause
  exit /b 1
)

echo.
echo [2/2] Checking the Electron runtime...
if not exist "node_modules\electron\dist\electron.exe" (
  echo     Electron binary missing - running its download script...
  call node node_modules\electron\install.js
  if errorlevel 1 (
    echo.
    echo [X] Could not download the Electron runtime.
    echo     If you are behind a firewall or proxy, allow
    echo     github.com/releases and retry.
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