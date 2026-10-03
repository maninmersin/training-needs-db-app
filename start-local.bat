@echo off
echo ========================================
echo Starting Local Stack (no cloud services)
echo   PostgreSQL - migrations - PostgREST - login server - app
echo ========================================
echo.
echo The browser will open at http://localhost:5173 once the app is ready.
echo Press Ctrl+C to stop everything.
echo.
echo ========================================

cd /d "%~dp0"

rem Open the browser only when the app answers (checks for up to 2 minutes)
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "$u='http://localhost:5173'; for($i=0;$i -lt 120;$i++){ try { Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process $u; break } catch { Start-Sleep 1 } }"

npm run local

pause
