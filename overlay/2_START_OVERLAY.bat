@echo off
REM ==========================================================
REM  GeoGuessr Overlay - START
REM  Launches the transparent always-on-top overlay window.
REM  (You also need the Steam Resolver or the browser
REM   userscript running so rounds get sent to the server.)
REM ==========================================================
title GeoGuessr Overlay

cd /d "%~dp0"

REM Run through npm so Node resolves Electron's own install path
REM (node_modules\electron\path.txt) instead of us guessing it.
call npm start
