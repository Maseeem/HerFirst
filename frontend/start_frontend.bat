@echo off
setlocal
cd /d "%~dp0"

echo ==================================================
echo HerFirst React frontend
echo ==================================================

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js was not found. Install Node.js 20.19+ or 22.12+ and reopen this window.
    pause
    exit /b 1
)
node -e "const v=process.versions.node.split('.').map(Number); process.exit((v[0]===20 && v[1]>=19) || (v[0]===22 && v[1]>=12) || v[0]>22 ? 0 : 1)"
if errorlevel 1 (
    echo ERROR: Vite 8 requires Node.js 20.19+ or 22.12+. Update Node.js and retry.
    pause
    exit /b 1
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm.cmd was not found. Repair/reinstall Node.js with npm included.
    pause
    exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
    echo Installing frontend dependencies from package-lock.json...
    call npm.cmd ci
    if errorlevel 1 (
        echo ERROR: npm ci failed. Check the npm output and network connection.
        pause
        exit /b 1
    )
)

echo Starting HerFirst frontend at http://localhost:5174/
echo Backend API default: http://localhost:8000
 echo Keep this window open. If port 5174 is occupied, Vite will report the conflict.
call npm.cmd run dev
set "SERVER_EXIT=%errorlevel%"
if not "%SERVER_EXIT%"=="0" echo ERROR: Frontend stopped with exit code %SERVER_EXIT%.
pause
exit /b %SERVER_EXIT%
