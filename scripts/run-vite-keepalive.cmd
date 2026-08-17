@echo off
REM FinDigest Vite keepalive — own console window, auto-restart on crash/exit.
title FinDigest Vite (keepalive)
cd /d "%~dp0.."

if not exist "node_modules\vite\bin\vite.js" (
  echo [FinDigest] node_modules missing. Running npm install...
  call npm install
)

echo [FinDigest] Keepalive watching http://127.0.0.1:5173/
echo [FinDigest] Close this window only if you want to stop the local server.
echo.

:loop
echo ---- %date% %time% starting Vite ---->> "%~dp0..\.vite-dev.log"
node "node_modules\vite\bin\vite.js" --host 127.0.0.1 --port 5173 >> "%~dp0..\.vite-dev.log" 2>&1
set EXITCODE=%ERRORLEVEL%
echo ---- %date% %time% Vite exited %EXITCODE%, restart in 2s ---->> "%~dp0..\.vite-dev.log"
echo [FinDigest] Vite stopped (code %EXITCODE%). Restarting in 2 seconds...
timeout /t 2 /nobreak >nul
goto loop
