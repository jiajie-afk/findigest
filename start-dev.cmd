@echo off
REM Double-click to start / restore FinDigest local server (auto-restarts if it dies).
cd /d "%~dp0"
node scripts\ensure-dev-server.mjs
if errorlevel 1 (
  echo.
  echo Failed to start. Showing last log lines:
  if exist .vite-dev.log more +0 .vite-dev.log
  pause
  exit /b 1
)
start "" "http://127.0.0.1:5173/app"
