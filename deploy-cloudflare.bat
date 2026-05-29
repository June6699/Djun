@echo off
setlocal

cd /d "%~dp0"

echo [DJun] Cloudflare Workers deploy
echo [DJun] This uses WSL Ubuntu-22.04 for the OpenNext build, then Windows Wrangler for deploy.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy-cloudflare.ps1" %*
set "exit_code=%ERRORLEVEL%"

if not "%exit_code%"=="0" (
  echo.
  echo [DJun] Deploy failed with exit code %exit_code%.
  if /I not "%~1"=="--no-pause" pause
  exit /b %exit_code%
)

echo.
echo [DJun] Deploy finished.
if /I not "%~1"=="--no-pause" pause
exit /b 0
