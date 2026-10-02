@echo off
echo ========================================
echo Starting Development Server
echo ========================================
echo.
echo Opening browser at http://localhost:5173
echo Press Ctrl+C to stop the server
echo.
echo ========================================

cd /d "%~dp0"
start http://localhost:5173
npm run dev

pause
