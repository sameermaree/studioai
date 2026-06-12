@echo off
echo Starting StudioAI Export Server...
cd /d "%~dp0"
python export_server.py
pause
