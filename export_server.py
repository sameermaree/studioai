"""
StudioAI Export Server
Minimal FastAPI server that exports episode scenes to MP4 via FFmpeg.
Run: python export_server.py
Port: 3333
"""

import os
import sys
import uuid
import json
import time
import shutil
import asyncio
import tempfile
import subprocess
import urllib.request
from pathlib import Path
from datetime import datetime
from typing import Optional

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse, JSONResponse
    from pydantic import BaseModel
    import uvicorn
except ImportError:
    print("Installing required packages...")
    subprocess.run([sys.executable, "-m", "pip", "install",
                    "fastapi", "uvicorn", "pydantic"], check=True)
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse, JSONResponse
    from pydantic import BaseModel
    import uvicorn

# ── Config ────────────────────────────────────────────
PORT = 3333
COMFY_BASE = "http://127.0.0.1:8188"
EXPORTS_DIR = Path(__file__).parent / "exports"
EXPORTS_DIR.mkdir(exist_ok=True)

# ── App ───────────────────────────────────────────────
app = FastAPI(title="StudioAI Export Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory job store ───────────────────────────────
jobs: dict[str, dict] = {}

# ── Models ────────────────────────────────────────────
class SceneExport(BaseModel):
    image_filename: str        # e.g. seri_ai_scene_00001_.png
    duration: float            # seconds
    narration: Optional[str] = None
    audio_url: Optional[str] = None  # real audio file from audio_server

class ExportRequest(BaseModel):
    episode_id: str
    episode_title: str
    scenes: list[SceneExport]
    output_filename: Optional[str] = None
    resolution: str = "1280x720"   # 1280x720 or 1920x1080
    fps: int = 24

# ── Helpers ───────────────────────────────────────────
def check_ffmpeg() -> bool:
    try:
        subprocess.run(["ffmpeg", "-version"],
                       capture_output=True, timeout=5)
        return True
    except Exception:
        return False

def download_image(filename: str, dest: Path) -> bool:
    """Download image from ComfyUI output folder."""
    url = f"{COMFY_BASE}/view?filename={urllib.parse.quote(filename)}&type=output"
    try:
        urllib.request.urlretrieve(url, dest)
        return dest.exists() and dest.stat().st_size > 0
    except Exception as e:
        print(f"[EXPORT] Failed to download {filename}: {e}")
        return False

import urllib.parse

def create_placeholder_image(dest: Path, width: int, height: int) -> bool:
    """Create a black placeholder image using FFmpeg."""
    try:
        subprocess.run([
            "ffmpeg", "-y",
            "-f", "lavfi",
            "-i", f"color=black:size={width}x{height}:rate=1",
            "-vframes", "1",
            str(dest)
        ], capture_output=True, timeout=10)
        return dest.exists()
    except Exception:
        return False

def parse_resolution(res: str) -> tuple[int, int]:
    try:
        w, h = res.split("x")
        return int(w), int(h)
    except Exception:
        return 1280, 720

# ── Export worker ─────────────────────────────────────
async def run_export(job_id: str, req: ExportRequest):
    job = jobs[job_id]
    tmp_dir = Path(tempfile.mkdtemp(prefix="studioai_export_"))

    try:
        width, height = parse_resolution(req.resolution)
        total_scenes = len(req.scenes)

        # ── Step 1: Download / prepare images ─────────
        job["status"] = "preparing"
        job["message"] = "Downloading scene images..."
        clip_files = []

        for i, scene in enumerate(req.scenes):
            job["progress"] = int((i / total_scenes) * 40)
            img_path = tmp_dir / f"scene_{i:03d}.png"

            success = download_image(scene.image_filename, img_path)
            if not success:
                print(f"[EXPORT] Scene {i+1}: no image, using placeholder")
                create_placeholder_image(img_path, width, height)

            # Convert image → video clip
            clip_path = tmp_dir / f"clip_{i:03d}.mp4"
            duration = max(1.0, scene.duration)

            result = subprocess.run([
                "ffmpeg", "-y",
                "-loop", "1",
                "-i", str(img_path),
                "-t", str(duration),
                "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black",
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "23",
                "-pix_fmt", "yuv420p",
                "-r", str(req.fps),
                str(clip_path)
            ], capture_output=True, timeout=60)

            if result.returncode != 0:
                err = result.stderr.decode()
                print(f"[EXPORT] FFmpeg clip error scene {i}: {err[-200:]}")
                raise RuntimeError(f"FFmpeg failed on scene {i+1}")

            # Mix audio if available
            print(f"[EXPORT AUDIO] scene {i}: audio_url={scene.audio_url or 'NONE'}")
            if scene.audio_url:
                audio_path = tmp_dir / f"audio_{i:03d}.mp3"
                try:
                    print(f"[EXPORT AUDIO] downloading: {scene.audio_url}")
                    urllib.request.urlretrieve(scene.audio_url, audio_path)
                    audio_exists = audio_path.exists() and audio_path.stat().st_size > 0
                    print(f"[EXPORT AUDIO] audio exists: {audio_exists} | size: {audio_path.stat().st_size if audio_path.exists() else 0} bytes")
                    if audio_exists:
                        mixed_path = tmp_dir / f"mixed_{i:03d}.mp4"
                        ffmpeg_merge_cmd = [
                            "ffmpeg", "-y",
                            "-i", str(clip_path),
                            "-i", str(audio_path),
                            "-c:v", "copy",
                            "-c:a", "aac",
                            "-b:a", "128k",
                            "-shortest",
                            str(mixed_path)
                        ]
                        print(f"[EXPORT AUDIO] ffmpeg merge: {' '.join(ffmpeg_merge_cmd)}")
                        mix_result = subprocess.run(
                            ffmpeg_merge_cmd, capture_output=True, timeout=60
                        )
                        if mix_result.returncode == 0 and mixed_path.exists():
                            # Verify audio stream in merged clip
                            probe = subprocess.run(
                                ["ffprobe", "-v", "quiet", "-show_streams",
                                 "-select_streams", "a", str(mixed_path)],
                                capture_output=True, text=True
                            )
                            has_audio = "codec_type=audio" in probe.stdout
                            print(f"[EXPORT AUDIO] merged clip has audio: {has_audio}")
                            clip_path = mixed_path
                        else:
                            err = mix_result.stderr.decode()[-200:]
                            print(f"[EXPORT AUDIO] merge FAILED: {err}")
                except Exception as e:
                    print(f"[EXPORT AUDIO] error fetching audio: {e}")

            clip_files.append(clip_path)

        # ── Step 2: Concatenate clips ──────────────────
        job["status"] = "rendering"
        job["message"] = "Assembling episode..."
        job["progress"] = 50

        concat_list = tmp_dir / "concat.txt"
        with open(concat_list, "w", encoding="utf-8") as f:
            for clip in clip_files:
                f.write(f"file '{clip.as_posix()}'\n")

        # Safe output filename — uses episode_id[:8] to avoid encoding issues
        ep_short = req.episode_id[:8] if req.episode_id else "episode"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_filename = req.output_filename or f"episode_{ep_short}_{timestamp}.mp4"
        out_path = EXPORTS_DIR / out_filename

        job["progress"] = 60

        result = subprocess.run([
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(concat_list),
            "-c", "copy",
            str(out_path)
        ], capture_output=True, timeout=300)

        if result.returncode != 0:
            err = result.stderr.decode()
            print(f"[EXPORT] Concat error: {err[-300:]}")
            raise RuntimeError("FFmpeg concat failed")

        job["progress"] = 95
        # Final ffprobe verification
        probe_final = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_streams", str(out_path)],
            capture_output=True, text=True
        )
        has_video = "codec_type=video" in probe_final.stdout
        has_audio = "codec_type=audio" in probe_final.stdout
        print(f"[EXPORT FINAL] video stream: {has_video} | audio stream: {has_audio}")
        job["status"] = "done"
        job["message"] = "Export complete"
        job["output_filename"] = out_filename
        job["output_path"] = str(out_path)
        job["file_size_mb"] = round(out_path.stat().st_size / 1024 / 1024, 2)
        job["has_audio"] = has_audio
        job["has_video"] = has_video
        job["progress"] = 100
        print(f"[EXPORT] Done: {out_path} | video={has_video} audio={has_audio}")

    except Exception as e:
        job["status"] = "failed"
        job["message"] = str(e)
        job["error"] = str(e)
        print(f"[EXPORT] Error: {e}")

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

# ── Routes ────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "ffmpeg": check_ffmpeg(),
        "exports_dir": str(EXPORTS_DIR),
        "version": "1.0.0"
    }

@app.post("/export")
async def start_export(req: ExportRequest):
    if not check_ffmpeg():
        raise HTTPException(500, "FFmpeg not found. Install FFmpeg and add to PATH.")

    if not req.scenes:
        raise HTTPException(400, "No scenes provided.")

    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "id": job_id,
        "status": "queued",
        "progress": 0,
        "message": "Queued",
        "episode_id": req.episode_id,
        "episode_title": req.episode_title,
        "created_at": datetime.now().isoformat(),
    }

    # Run in background
    asyncio.create_task(run_export(job_id, req))
    return {"job_id": job_id, "status": "queued"}

@app.get("/export/{job_id}/status")
def get_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job

@app.get("/download/{filename}")
def download_file(filename: str):
    # Security: only allow files in exports dir
    file_path = EXPORTS_DIR / Path(filename).name
    if not file_path.exists():
        raise HTTPException(404, "File not found")
    return FileResponse(
        str(file_path),
        media_type="video/mp4",
        filename=file_path.name
    )

@app.get("/exports")
def list_exports():
    files = []
    for f in EXPORTS_DIR.glob("*.mp4"):
        files.append({
            "filename": f.name,
            "size_mb": round(f.stat().st_size / 1024 / 1024, 2),
            "created": datetime.fromtimestamp(f.stat().st_ctime).isoformat()
        })
    return sorted(files, key=lambda x: x["created"], reverse=True)

# ── Main ──────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 50)
    print("  StudioAI Export Server")
    print(f"  http://localhost:{PORT}")
    print(f"  Exports folder: {EXPORTS_DIR}")
    print(f"  FFmpeg: {'OK' if check_ffmpeg() else 'NOT FOUND - install FFmpeg'}")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")