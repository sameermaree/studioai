/**
 * exportService.ts
 * Frontend bridge to the StudioAI Export Server (localhost:3333).
 * Handles: health check, starting export, polling status, download.
 */

const EXPORT_SERVER = 'http://localhost:3333';
const POLL_INTERVAL_MS = 2000;

export interface ExportScene {
  image_filename: string;
  duration: number;
  narration?: string;
}

export interface ExportRequest {
  episode_id: string;
  episode_title: string;
  scenes: ExportScene[];
  resolution?: '1280x720' | '1920x1080';
  fps?: number;
  output_filename?: string;
}

export interface ExportJob {
  id: string;
  status: 'queued' | 'preparing' | 'rendering' | 'done' | 'failed';
  progress: number;
  message: string;
  episode_id: string;
  episode_title: string;
  output_filename?: string;
  file_size_mb?: number;
  error?: string;
}

export interface ServerHealth {
  ok: boolean;
  ffmpeg: boolean;
  error?: string;
}

/** Check if export server is running */
export async function checkExportServer(): Promise<ServerHealth> {
  try {
    const res = await fetch(`${EXPORT_SERVER}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { ok: false, ffmpeg: false, error: 'Server error' };
    const data = await res.json();
    return { ok: true, ffmpeg: data.ffmpeg === true };
  } catch {
    return { ok: false, ffmpeg: false, error: 'Server not running' };
  }
}

/** Start an export job. Returns job_id. */
export async function startExport(req: ExportRequest): Promise<string> {
  const res = await fetch(`${EXPORT_SERVER}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Export failed: ${res.status}`);
  }
  const data = await res.json();
  return data.job_id as string;
}

/** Get current status of an export job */
export async function getExportStatus(jobId: string): Promise<ExportJob> {
  const res = await fetch(`${EXPORT_SERVER}/export/${jobId}/status`);
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  return res.json();
}

/** Poll until done or failed. Calls onProgress with each update. */
export async function waitForExport(
  jobId: string,
  onProgress: (job: ExportJob) => void,
  signal?: AbortSignal
): Promise<ExportJob> {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (signal?.aborted) { reject(new Error('Cancelled')); return; }
      try {
        const job = await getExportStatus(jobId);
        onProgress(job);
        if (job.status === 'done') { resolve(job); return; }
        if (job.status === 'failed') { reject(new Error(job.error || 'Export failed')); return; }
        setTimeout(poll, POLL_INTERVAL_MS);
      } catch (e) {
        reject(e);
      }
    };
    poll();
  });
}

/** Get the download URL for a completed export */
export function getDownloadUrl(filename: string): string {
  return `${EXPORT_SERVER}/download/${encodeURIComponent(filename)}`;
}

/** List previous exports */
export async function listExports(): Promise<{ filename: string; size_mb: number; created: string }[]> {
  try {
    const res = await fetch(`${EXPORT_SERVER}/exports`);
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}
