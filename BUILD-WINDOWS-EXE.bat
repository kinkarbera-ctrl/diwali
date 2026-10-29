@echo off
setlocal
cd /d "%~dp0"
echo === Birla Diwali Prize Royal Gold - EXE Builder ===
where node >nul 2>nul || (echo Node.js not found. Install Node.js 22 LTS first.& pause & exit /b 1)
call npm install
if errorlevel 1 goto failed
call npm run dist:win
if errorlevel 1 goto failed
echo Build output is in the dist folder.
pause
exit /b 0
:failed
echo BUILD FAILED. Review the error above.
pause
exit /b 1
