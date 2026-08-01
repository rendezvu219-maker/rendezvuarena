@echo off
setlocal
if "%~1"=="" (
  echo Usage: PUBLISH_TO_GITHUB_WINDOWS.bat https://github.com/USERNAME/rendezvu-arena.git
  exit /b 1
)
where git >nul 2>nul || (echo Git is not installed.& exit /b 1)
if not exist .git git init
git branch -M main
git add .
git commit -m "Initial RendezVu Arena release" || echo No new commit was created.
git remote remove origin >nul 2>nul
git remote add origin "%~1"
git push -u origin main
endlocal
