@echo off
echo Starting Vocab Builder...

REM Start Backend
start "Vocab Backend" cmd /k "cd /d %~dp0 && node server.js"

REM Start Frontend
start "Vocab Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Backend running on window 1...
echo Frontend running on window 2...
echo You can now open http://localhost:5173
pause
