@echo off
setlocal
cd /d "%~dp0"
echo Project Toolpath - GitHub publish
echo.
git status --short --branch
echo.
git push -u origin codex/machining-systems-v3
if errorlevel 1 goto failed
echo.
echo Branch published successfully.
echo Open or update the pull request at:
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
