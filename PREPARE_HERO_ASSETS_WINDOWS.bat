@echo off
setlocal
cd /d "%~dp0"
echo Downloading and validating local hero assets...
call npm run assets:heroes
if errorlevel 1 goto :failed
call npm run assets:heroes:verify
if errorlevel 1 goto :failed
echo.
echo Hero assets are ready. You can now run npm start.
pause
exit /b 0
:failed
echo.
echo Asset preparation failed. Review the error above. No invalid response is accepted as an image.
pause
exit /b 1
