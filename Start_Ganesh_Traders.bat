@echo off
title Ganesh Traders POS & Billing System
echo ===================================================================
echo               GANESH TRADERS - BILLING & POS SYSTEM
echo ===================================================================
echo.
echo [1/2] Starting local database & API server on port 8000...

cd /d "%~dp0"
start "" /B "C:\Program Files\Python311\python.exe" -m uvicorn app.main:app --app-dir "%~dp0backend" --port 8000

timeout /t 2 /nobreak >nul

echo [2/2] Opening Ganesh Traders Desktop App...
start msedge --app=http://localhost:8000 || start chrome --app=http://localhost:8000 || start http://localhost:8000

echo.
echo ===================================================================
echo System is active and running!
echo URL: http://localhost:8000
echo Minimize this window while using the application.
echo To stop the system, close this window.
echo ===================================================================
pause
