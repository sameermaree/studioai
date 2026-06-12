"""
StudioAI Audio Server — Multi-Provider TTS
Providers: edge-tts (free) | ElevenLabs (production) | OpenAI TTS
Port: 3334
"""

import os, sys, uuid, json, asyncio, subprocess, shutil
from pathlib import Path
from datetime import datetime
from typing import Optional

# ── Auto-install core deps ─────────────────────────────────
def pip(pkg):
    subprocess.run([sys.executable, "-m", "pip", "install", pkg, "-q"], check=True)

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse
    from pydantic import BaseModel
    import uvicorn
except ImportError:
    pip("fastapi uvicorn pydantic")
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse
    from pydantic import BaseModel
    import uvicorn

try:
    import edge_tts
    EDGE_AVAILABLE = True
except ImportError:
    pip("edge-tts")
    try:
        import edge_tts
        EDGE_AVAILABLE = True
    except Exception:
        EDGE_AVAILABLE = False

# ── Config ─────────────────────────────────────────────────
PORT      = 3334
AUDIO_DIR = Path(__file__).parent / "audio"
KEYS_FILE = Path(__file__).parent / ".studio_api_keys.json"
AUDIO_DIR.mkdir(exist_ok=True)

# ── API Keys store (saved on disk) ─────────────────────────
def load_keys() -> dict:
    if KEYS_FILE.exists():
        try:
            return json.loads(KEYS_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}

def save_keys(keys: dict):
    KEYS_FILE.write_text(json.dumps(keys, indent=2), encoding="utf-8")

API_KEYS = load_keys()

# ── Voice catalogs ─────────────────────────────────────────
EDGE_VOICES = [
    {"id": "ar-SA-ZariyahNeural",  "name": "Zariyah",  "lang": "ar-SA", "gender": "female"},
    {"id": "ar-SA-HamedNeural",    "name": "Hamed",    "lang": "ar-SA", "gender": "male"},
    {"id": "ar-EG-SalmaNeural",    "name": "Salma",    "lang": "ar-EG", "gender": "female"},
    {"id": "ar-EG-ShakirNeural",   "name": "Shakir",   "lang": "ar-EG", "gender": "male"},
    {"id": "en-US-JennyNeural",    "name": "Jenny",    "lang": "en-US", "gender": "female"},
    {"id": "en-US-GuyNeural",      "name": "Guy",      "lang": "en-US", "gender": "male"},
    {"id": "en-US-AriaNeural",     "name": "Aria",     "lang": "en-US", "gender": "female"},
    {"id": "en-GB-SoniaNeural",    "name": "Sonia",    "lang": "en-GB", "gender": "female"},
    {"id": "fr-FR-DeniseNeural",   "name": "Denise",   "lang": "fr-FR", "gender": "female"},
    {"id": "fr-FR-HenriNeural",    "name": "Henri",    "lang": "fr-FR", "gender": "male"},
]

ELEVENLABS_VOICES = [
    {"id": "21m00Tcm4TlvDq8ikWAM", "name": "Rachel",     "lang": "en",  "gender": "female", "description": "Calm, narration"},
    {"id": "AZnzlk1XvdvUeBnXmlld", "name": "Domi",       "lang": "en",  "gender": "female", "description": "Confident, story"},
    {"id": "EXAVITQu4vr4xnSDxMaL", "name": "Bella",      "lang": "en",  "gender": "female", "description": "Soft, children"},
    {"id": "ErXwobaYiN019PkySvjV", "name": "Antoni",     "lang": "en",  "gender": "male",   "description": "Warm, narrator"},
    {"id": "MF3mGyEYCl7XYWbV9V6O", "name": "Elli",       "lang": "en",  "gender": "female", "description": "Emotional, young"},
    {"id": "TxGEqnHWrfWFTfGW9XjX", "name": "Josh",       "lang": "en",  "gender": "male",   "description": "Deep, engaging"},
    {"id": "VR6AewLTigWG4xSOukaG", "name": "Arnold",     "lang": "en",  "gender": "male",   "description": "Crisp, strong"},
    {"id": "pNInz6obpgDQGcFmaJgB", "name": "Adam",       "lang": "en",  "gender": "male",   "description": "Deep, narrative"},
    {"id": "yoZ06aMxZJJ28mfd3POQ", "name": "Sam",        "lang": "en",  "gender": "male",   "description": "Raspy, intense"},
    # Multilingual v2 — Arabic support
    {"id": "XB0fDUnXU5powFXDhCwa", "name": "Charlotte",  "lang": "ar",  "gender": "female", "description": "Arabic storytelling"},
    {"id": "onwK4e9ZLuTAKqWW03F9", "name": "Daniel",     "lang": "ar",  "gender": "male",   "description": "Arabic narrator"},
]

OPENAI_VOICES = [
    {"id": "alloy",   "name": "Alloy",   "lang": "multi", "gender": "neutral", "description": "Balanced"},
    {"id": "echo",    "name": "Echo",    "lang": "multi", "gender": "male",    "description": "Smooth"},
    {"id": "fable",   "name": "Fable",   "lang": "multi", "gender": "female",  "description": "Expressive"},
    {"id": "onyx",    "name": "Onyx",    "lang": "multi", "gender": "male",    "description": "Deep, authoritative"},
    {"id": "nova",    "name": "Nova",    "lang": "multi", "gender": "female",  "description": "Warm, energetic"},
    {"id": "shimmer", "name": "Shimmer", "lang": "multi", "gender": "female",  "description": "Soft, clear"},
]

PROVIDER_VOICES = {
    "edge-tts":    EDGE_VOICES,
    "elevenlabs":  ELEVENLABS_VOICES,
    "openai":      OPENAI_VOICES,
}

# ── Provider abstraction ───────────────────────────────────
class TTSProvider:
    async def generate(self, text: str, voice_id: str, rate: str,
                       volume: str, output_path: Path, **kwargs) -> float:
        raise NotImplementedError

    def is_available(self) -> bool:
        return False

    def name(self) -> str:
        return "unknown"


class EdgeTTSProvider(TTSProvider):
    def is_available(self) -> bool:
        return EDGE_AVAILABLE

    def name(self) -> str:
        return "edge-tts"

    async def generate(self, text, voice_id, rate, volume, output_path, **kwargs) -> float:
        communicate = edge_tts.Communicate(text, voice_id, rate=rate, volume=volume)
        await communicate.save(str(output_path))
        if not output_path.exists() or output_path.stat().st_size == 0:
            raise RuntimeError("edge-tts produced empty file")
        return _get_duration(output_path)


class ElevenLabsProvider(TTSProvider):
    def is_available(self) -> bool:
        return bool(API_KEYS.get("elevenlabs"))

    def name(self) -> str:
        return "elevenlabs"

    async def generate(self, text, voice_id, rate, volume, output_path, **kwargs) -> float:
        api_key = API_KEYS.get("elevenlabs")
        if not api_key:
            raise RuntimeError("ElevenLabs API key not set")

        # Stability/similarity from kwargs
        stability        = float(kwargs.get("stability", 0.5))
        similarity_boost = float(kwargs.get("similarity_boost", 0.8))
        style            = float(kwargs.get("style", 0.3))

        try:
            import httpx
        except ImportError:
            pip("httpx")
            import httpx

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": stability,
                "similarity_boost": similarity_boost,
                "style": style,
                "use_speaker_boost": True,
            },
        }

        print(f"[ELEVENLABS] voice_id = {voice_id}")
        print(f"[ELEVENLABS] text length = {len(text)} chars")
        print(f"[ELEVENLABS] model = eleven_multilingual_v2")
        print(f"[ELEVENLABS] endpoint = {url}")

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, headers=headers, json=payload)
            print(f"[ELEVENLABS] response status = {resp.status_code}")
            if resp.status_code != 200:
                err = resp.text[:500]
                print(f"[ELEVENLABS] error body = {err}")
                raise RuntimeError(f"ElevenLabs error {resp.status_code}: {err}")
            print(f"[ELEVENLABS] audio bytes received = {len(resp.content)}")
            output_path.write_bytes(resp.content)
            print(f"[AUDIO SAVE] output path = {output_path}")

        if not output_path.exists() or output_path.stat().st_size == 0:
            raise RuntimeError("ElevenLabs returned empty audio")
        return _get_duration(output_path)


class OpenAITTSProvider(TTSProvider):
    def is_available(self) -> bool:
        return bool(API_KEYS.get("openai"))

    def name(self) -> str:
        return "openai"

    async def generate(self, text, voice_id, rate, volume, output_path, **kwargs) -> float:
        api_key = API_KEYS.get("openai")
        if not api_key:
            raise RuntimeError("OpenAI API key not set")

        try:
            import httpx
        except ImportError:
            pip("httpx")
            import httpx

        url = "https://api.openai.com/v1/audio/speech"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "tts-1-hd",
            "voice": voice_id,
            "input": text,
            "response_format": "mp3",
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"OpenAI TTS error {resp.status_code}: {resp.text[:200]}")
            output_path.write_bytes(resp.content)

        if not output_path.exists() or output_path.stat().st_size == 0:
            raise RuntimeError("OpenAI TTS returned empty audio")
        return _get_duration(output_path)


# ── Provider registry ──────────────────────────────────────
PROVIDERS: dict[str, TTSProvider] = {
    "edge-tts":   EdgeTTSProvider(),
    "elevenlabs": ElevenLabsProvider(),
    "openai":     OpenAITTSProvider(),
}

def get_provider(name: str) -> TTSProvider:
    p = PROVIDERS.get(name)
    if not p:
        raise HTTPException(400, f"Unknown provider: {name}")
    return p

def _get_duration(path: Path) -> float:
    """Get audio duration via ffprobe, fallback to size estimate."""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
             "-of", "csv=p=0", str(path)],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            return round(float(result.stdout.strip()), 2)
    except Exception:
        pass
    return round(path.stat().st_size / (32000 / 8), 2)


# ── FastAPI ────────────────────────────────────────────────
app = FastAPI(title="StudioAI Audio Server", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

jobs: dict[str, dict] = {}


# ── Models ─────────────────────────────────────────────────
class GenerateRequest(BaseModel):
    episode_id:       str
    scene_id:         str
    text:             str
    voice_id:         str  = "en-US-JennyNeural"
    provider:         str  = "edge-tts"
    rate:             str  = "+0%"
    volume:           str  = "+0%"
    stability:        float = 0.5
    similarity_boost: float = 0.8
    style:            float = 0.3

class ApiKeyRequest(BaseModel):
    provider: str
    api_key:  str


# ── Worker ─────────────────────────────────────────────────
async def run_generate(job_id: str, req: GenerateRequest):
    job = jobs[job_id]
    try:
        job["status"] = "generating"
        job["progress"] = 10

        ep_dir = AUDIO_DIR / req.episode_id[:8]
        ep_dir.mkdir(parents=True, exist_ok=True)
        output_path = ep_dir / f"{req.scene_id[:8]}.mp3"
        if output_path.exists():
            output_path.unlink()

        provider = get_provider(req.provider)
        print(f"[AUDIO GENERATE] provider={req.provider} voice={req.voice_id} text_len={len(req.text)}")
        if not req.text.strip():
            raise RuntimeError("Text is empty — scene has no narration")
        job["progress"] = 20

        duration = await provider.generate(
            text        = req.text,
            voice_id    = req.voice_id,
            rate        = req.rate,
            volume      = req.volume,
            output_path = output_path,
            stability        = req.stability,
            similarity_boost = req.similarity_boost,
            style            = req.style,
        )

        audio_url = (
            f"http://localhost:{PORT}/audio/file/"
            f"{req.episode_id[:8]}/{output_path.name}"
        )
        job.update({
            "status":           "done",
            "progress":         100,
            "duration_seconds": duration,
            "audio_url":        audio_url,
            "episode_short":    req.episode_id[:8],
            "scene_short":      req.scene_id[:8],
            "provider":         req.provider,
            "voice_id":         req.voice_id,
        })
        print(f"[AUDIO] Done: {output_path.name} ({duration:.1f}s) via {req.provider}")

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        job.update({"status": "failed", "error": str(e), "progress": 0})
        print(f"[AUDIO ERROR] provider={req.provider} voice={req.voice_id}")
        print(f"[AUDIO ERROR] {e}")
        print(f"[AUDIO ERROR] traceback:\n{tb}")


# ── Routes ─────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status":    "ok",
        "version":   "2.0.0",
        "providers": {
            name: {
                "available": p.is_available(),
                "has_key":   bool(API_KEYS.get(name)) if name != "edge-tts" else True,
            }
            for name, p in PROVIDERS.items()
        },
        "audio_dir": str(AUDIO_DIR),
    }


@app.get("/providers")
def list_providers():
    return [
        {
            "id":        name,
            "label":     {"edge-tts": "Edge TTS (Free)", "elevenlabs": "ElevenLabs", "openai": "OpenAI TTS"}[name],
            "available": p.is_available(),
            "has_key":   bool(API_KEYS.get(name)) if name != "edge-tts" else True,
            "needs_key": name != "edge-tts",
        }
        for name, p in PROVIDERS.items()
    ]


@app.get("/voices")
def list_voices(provider: str = "edge-tts", lang: Optional[str] = None):
    voices = PROVIDER_VOICES.get(provider, [])
    if lang:
        voices = [v for v in voices if v["lang"].startswith(lang)]
    return voices


@app.post("/settings/apikey")
def set_api_key(req: ApiKeyRequest):
    if req.provider not in PROVIDERS:
        raise HTTPException(400, f"Unknown provider: {req.provider}")
    API_KEYS[req.provider] = req.api_key.strip()
    save_keys(API_KEYS)
    # Reload provider availability
    return {"ok": True, "provider": req.provider,
            "available": PROVIDERS[req.provider].is_available()}


@app.get("/settings/providers")
def get_provider_status():
    return {
        name: {"has_key": bool(API_KEYS.get(name))}
        for name in PROVIDERS
        if name != "edge-tts"
    }


@app.post("/audio/generate")
async def generate_audio(req: GenerateRequest):
    provider = get_provider(req.provider)
    if not provider.is_available():
        raise HTTPException(503,
            f"Provider '{req.provider}' not available. "
            f"{'Set API key first.' if req.provider != 'edge-tts' else 'Install edge-tts.'}"
        )
    if not req.text.strip():
        raise HTTPException(400, "Text is empty.")

    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "id":         job_id,
        "status":     "queued",
        "progress":   0,
        "provider":   req.provider,
        "episode_id": req.episode_id,
        "scene_id":   req.scene_id,
        "created_at": datetime.now().isoformat(),
    }
    asyncio.create_task(run_generate(job_id, req))
    return {"job_id": job_id, "status": "queued"}


@app.get("/audio/{job_id}/status")
def get_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@app.get("/audio/file/{episode_short}/{filename}")
def serve_audio(episode_short: str, filename: str):
    file_path = AUDIO_DIR / Path(episode_short).name / Path(filename).name
    if not file_path.exists():
        raise HTTPException(404, "Audio file not found")
    return FileResponse(str(file_path), media_type="audio/mpeg",
                        filename=file_path.name)


@app.delete("/audio/{episode_short}/{scene_short}")
def delete_audio(episode_short: str, scene_short: str):
    file_path = AUDIO_DIR / Path(episode_short).name / f"{Path(scene_short).name}.mp3"
    if file_path.exists():
        file_path.unlink()
        return {"deleted": True}
    return {"deleted": False}


# ── Main ───────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 52)
    print("  StudioAI Audio Server v2.0")
    print(f"  http://localhost:{PORT}")
    for name, p in PROVIDERS.items():
        status = "OK" if p.is_available() else ("needs API key" if name != "edge-tts" else "NOT AVAILABLE")
        print(f"  {name}: {status}")
    print(f"  Audio dir: {AUDIO_DIR}")
    print("=" * 52)
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
