@echo off
setlocal
cd /d "%~dp0"

echo ==================================================
echo HerFirst FastAPI backend
echo ==================================================

where py >nul 2>nul
if %errorlevel%==0 (
    py -3.13 --version >nul 2>nul
    if not errorlevel 1 (
        set "PYTHON_CMD=py -3.13"
    ) else (
        py -3.12 --version >nul 2>nul
        if not errorlevel 1 (
            set "PYTHON_CMD=py -3.12"
        ) else (
            echo Python 3.12 or 3.13 was not found through the Windows Python launcher.
            echo Install Python 3.12 or 3.13 from https://www.python.org/downloads/
            echo Python 3.14+ may not be supported by all dependencies yet.
            pause
            exit /b 1
        )
    )
) else (
    python -c "import sys; raise SystemExit(0 if (3, 10) <= sys.version_info[:2] <= (3, 13) else 1)" >nul 2>nul
    if errorlevel 1 (
        echo Supported Python 3.10-3.13 was not found.
        echo Install Python 3.12 or 3.13 and ensure it is on PATH.
        pause
        exit /b 1
    )
    set "PYTHON_CMD=python"
)

if not exist ".venv\Scripts\python.exe" (
    echo Creating backend virtual environment...
    %PYTHON_CMD% -m venv .venv
    if errorlevel 1 (
        echo ERROR: Could not create .venv. Verify the selected Python installation.
        pause
        exit /b 1
    )
)

echo Installing/checking backend dependencies...
".venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 (
    echo ERROR: pip upgrade failed. Check network access and Python installation.
    pause
    exit /b 1
)
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Dependency installation failed. See the messages above.
    pause
    exit /b 1
)

echo Checking backend imports...
".venv\Scripts\python.exe" -c "from app.main import app; print('FastAPI import OK:', app.title)"
if errorlevel 1 (
    echo ERROR: Backend import check failed. See the traceback above.
    pause
    exit /b 1
)

echo Starting HerFirst API at http://127.0.0.1:8000
echo Health: http://127.0.0.1:8000/api/health
echo Swagger: http://127.0.0.1:8000/docs
echo Keep this window open. If startup fails, the error will appear below.
".venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
set "SERVER_EXIT=%errorlevel%"
if not "%SERVER_EXIT%"=="0" echo ERROR: Uvicorn stopped with exit code %SERVER_EXIT%.
pause
exit /b %SERVER_EXIT%
