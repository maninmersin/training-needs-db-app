@echo off
echo ========================================
echo Starting Local Stack (no cloud services)
echo   PostgreSQL - migrations - PostgREST - login server - app
echo ========================================
echo.
echo The app will open at http://localhost:5173 in a few seconds.
echo Press Ctrl+C to stop everything.
echo.
echo ========================================

cd /d "%~dp0"

rem Give the database and servers time to start before opening the browser
start "" cmd /c "timeout /t 10 /nobreak >nul & start http://localhost:5173"

npm run local

pause
