@echo off
REM ==========================================================
REM  GeoGuessr Overlay - START
REM  Launches the transparent always-on-top overlay window.
REM  (You also need the Steam Resolver or the browser
REM   userscript running so rounds get sent to the server.)
REM ==========================================================
echo ==========================================================
echo   Starting GeoGuessr Overlay...
echo   User ID: 11111111-1111-4111-8111-111111111111
echo ==========================================================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
  echo [!] Dependencies are missing - running first-time setup...
  echo.
  call 1_INSTALL_FIRST_TIME.bat
  exit /b
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo [!] Electron runtime missing - running first-time setup...
  echo.
  call 1_INSTALL_FIRST_TIME.bat
  exit /b
)

REM start "" launches it detached so this window can close freely.
start "" "node_modules\electron\dist\electron.exe" "%~dp0"

exit /b