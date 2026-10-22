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

REM setup.js installs deps and, if needed, runs Electron's own
REM installer directly so it works even when npm blocks postinstall
REM scripts (npm 12+ does this by default).
node setup.js
set SETUP_RESULT=%errorlevel%

echo.
if not "%SETUP_RESULT%"=="0" (
  pause
  exit /b %SETUP_RESULT%
)

echo Press any key to close this window...
pause >nul