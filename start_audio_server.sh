#!/bin/bash
pip install edge-tts fastapi uvicorn pydantic -q
cd "$(dirname "$0")"
python3 audio_server.py
