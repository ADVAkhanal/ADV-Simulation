@echo off
setlocal
cd /d "%~dp0"
echo Project Toolpath - publish latest 3D shop-floor build
echo.
git status --short --branch
echo.
echo Latest local commit:
git log -1 --oneline
echo.
git push -u origin codex/machining-systems-v3
if errorlevel 1 goto failed
echo.
echo Latest 3D world work published successfully.
echo Open or update the pull request here:
echo https://github.com/ADVAkhanal/ADV-Game/pull/new/codex/machining-systems-v3
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
