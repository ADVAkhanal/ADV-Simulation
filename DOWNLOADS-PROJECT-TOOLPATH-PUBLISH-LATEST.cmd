@echo off
setlocal
cd /d "%~dp0"
echo Project Toolpath - publish latest main build
echo.
git status --short --branch
echo.
echo Latest local commit:
git log -1 --oneline
echo.
git push origin main
if errorlevel 1 goto failed
echo.
echo Latest 3D world work published successfully.
echo Main is live on GitHub. Railway can now deploy this build.
echo.
pause
exit /b 0

:failed
echo.
echo Push failed. Run: gh auth login -h github.com --web
echo Then double-click this file again.
echo.
pause
exit /b 1
