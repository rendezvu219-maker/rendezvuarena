@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed.
  echo Install Node.js 22.5 or newer, then run this file again.
  pause
  exit /b 1
)

if not exist ".env" (
  copy /Y ".env.example" ".env" >nul
  echo Created .env from .env.example
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo Tournament Operations: http://localhost:3000/dashboard.html
echo Player & Captain Portal:       http://localhost:3000/portal.html
echo Draft UI:             http://localhost:3000/
echo Press Ctrl+C to stop the server.
echo.
call npm start
pause
