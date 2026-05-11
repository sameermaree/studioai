import type { SubtitleEntry, SubtitleTrack, Language } from '../../types';

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

export function formatTimeVTT(seconds: number): string {
  return formatTime(seconds).replace(',', '.');
}

export function exportSRT(entries: SubtitleEntry[]): string {
  return entries
    .sort((a, b) => a.index - b.index)
    .map((entry) =>
      `${entry.index}\n${formatTime(entry.start_time)} --> ${formatTime(entry.end_time)}\n${entry.text}\n`
    )
    .join('\n');
}

export function exportVTT(entries: SubtitleEntry[]): string {
  const header = 'WEBVTT\n\n';
  const body = entries
    .sort((a, b) => a.index - b.index)
    .map((entry) =>
      `${entry.index}\n${formatTimeVTT(entry.start_time)} --> ${formatTimeVTT(entry.end_time)}\n${entry.text}\n`
    )
    .join('\n');
  return header + body;
}

export function createSubtitleTrack(
  sceneId: string | null,
  episodeId: string | null,
  language: Language,
  entries: SubtitleEntry[]
): SubtitleTrack {
  return {
    id: crypto.randomUUID(),
    scene_id: sceneId,
    episode_id: episodeId,
    language,
    entries,
    format: 'srt',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function generateSubtitlesFromNarration(narration: string, duration: number): SubtitleEntry[] {
  if (!narration.trim()) return [];
  const sentences = narration.split(/[.!?]+/).filter((s) => s.trim());
  const timePerSentence = duration / sentences.length;

  return sentences.map((text, i) => ({
    id: crypto.randomUUID(),
    index: i + 1,
    start_time: i * timePerSentence,
    end_time: (i + 1) * timePerSentence,
    text: text.trim(),
  }));
}

export async function translateSubtitles(
  _entries: SubtitleEntry[],
  _fromLang: Language,
  _toLang: Language
): Promise<SubtitleEntry[]> {
  return _entries.map((e) => ({ ...e, id: crypto.randomUUID() }));
}
