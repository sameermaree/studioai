@echo off
title StudioAI Studio Launcher
echo.
echo  ============================================
echo   StudioAI Production Studio
echo   Starting all services...
echo  ============================================
echo.

cd /d "%~dp0"

:: Export Server
start "StudioAI Export Server" cmd /k "title StudioAI Export Server && echo [EXPORT SERVER] Starting on port 3333... && python export_server.py"

:: Wait 1 second before next
timeout /t 1 /nobreak >nul

:: Audio Server
start "StudioAI Audio Server" cmd /k "title StudioAI Audio Server && echo [AUDIO SERVER] Starting on port 3334... && python audio_server.py"

:: Wait 1 second before frontend
timeout /t 1 /nobreak >nul

:: Frontend
start "StudioAI Frontend" cmd /k "title StudioAI Frontend && echo [FRONTEND] Starting Vite dev server... && npm run dev"

echo.
echo  ============================================
echo   All services launched in separate windows.
echo   Close this window or press any key to exit.
echo  ============================================
echo.
pause >nul
