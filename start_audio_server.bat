@echo off
echo Starting StudioAI Audio Server...
echo Installing edge-tts if needed...
pip install edge-tts fastapi uvicorn pydantic -q
cd /d "%~dp0"
python audio_server.py
pause
