@echo off
setlocal
cd /d "%~dp0"

echo [1/3] Downloading official Japanese, Simplified Chinese, Korean, and Spanish hero text...
call npm run i18n:heroes:sync
if errorlevel 1 goto :failed

echo [2/3] Verifying complete current-roster coverage for every official locale...
call npm run i18n:heroes:verify:full
if errorlevel 1 goto :failed

echo [3/3] Running i18n regression tests...
call npm run test:i18n
if errorlevel 1 goto :failed

echo.
echo Official hero translations are ready.
pause
exit /b 0

:failed
echo.
echo Sync failed. No partial catalog is written unless --allow-partial is used.
echo Check the error above. If a page was downloaded, inspect data\locales\sync-failures\ for HTML/text diagnostics.
pause
exit /b 1
