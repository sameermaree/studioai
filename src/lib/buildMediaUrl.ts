/**
 * buildMediaUrl.ts
 * Single source of truth for ComfyUI image URLs.
 * Handles: filename only, full URL, double-encoded URL.
 */
const COMFY_BASE = 'http://127.0.0.1:8188';

/** Extract clean filename from any image reference */
export function normalizeImageFilename(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();

  // Already a full ComfyUI URL → extract filename
  if (v.includes('/view?filename=')) {
    const raw = v.split('filename=')[1]?.split('&')[0] ?? '';
    const decoded = decodeURIComponent(raw);
    // Guard against double-encoding: if decoded still has /view?filename= → extract again
    if (decoded.includes('/view?filename=')) {
      const inner = decoded.split('filename=')[1]?.split('&')[0] ?? '';
      return decodeURIComponent(inner) || null;
    }
    return decoded || null;
  }

  // Path with slashes → take last segment
  if (v.includes('/') || v.includes('\\')) {
    return v.split(/[/\\]/).pop() || null;
  }

  // Already a clean filename
  return v;
}

/** Build a valid ComfyUI view URL from any image reference */
export function buildMediaUrl(
  value: string | null | undefined,
  type: 'output' | 'input' = 'output'
): string | null {
  const filename = normalizeImageFilename(value);
  if (!filename) return null;
  const url = `${COMFY_BASE}/view?filename=${encodeURIComponent(filename)}&type=${type}`;
  console.log('[FINAL IMAGE URL]', url, '← from raw:', typeof value === 'string' ? value.slice(0, 60) : value);
  return url;
}

/** Alias — used by SceneCard and other components */
export const buildComfyUrl = buildMediaUrl;
