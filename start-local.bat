@echo off
setlocal

cd /d "%~dp0"

echo [DJun] Local production start
echo [DJun] Repository: %CD%

if not exist "node_modules" (
  echo [DJun] node_modules not found, running npm ci...
  call npm ci --no-audit --progress=false
  if errorlevel 1 goto fail
)

echo [DJun] Building with Next.js...
call npm run build
if errorlevel 1 goto fail

if /I "%~1"=="--build-only" (
  echo [DJun] Build completed.
  exit /b 0
)

echo [DJun] Starting http://localhost:3000
echo [DJun] Press Ctrl+C to stop the server.
start "" "http://localhost:3000"
call npm run start
exit /b %ERRORLEVEL%

:fail
echo.
echo [DJun] Failed. Check the output above.
if /I not "%~1"=="--build-only" pause
exit /b 1
