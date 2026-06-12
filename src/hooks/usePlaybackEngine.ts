/**
 * usePlaybackEngine.ts
 * Manages playback interval, scene tracking, and audio sync.
 * Phase 3: plays narration via Web Speech API when scene changes.
 */
import { useEffect, useRef } from 'react';
import { useTimelineStore } from '../store/useTimelineStore';
import { useTimelineScenes } from './useTimelineScenes';
import { speakText, stopSpeech } from '../services/sceneAudioService';
import { useStudioStore } from '../store/useStudioStore';

export function usePlaybackEngine() {
  const { isPlaying, currentTime, tick, setActiveScene, activeSceneId } = useTimelineStore();
  const { orderedScenes, totalDuration } = useTimelineScenes();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActiveSceneIdRef = useRef<string | null>(null);
  const audioEls = useRef<Map<string, HTMLAudioElement>>(new Map());
  const episodes = useStudioStore((s) => s.episodes);

  // ── Interval: advance time ─────────────────────────
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        tick(totalDuration);
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Stop speech when paused/stopped
      stopSpeech();
      // Pause all audio elements
      audioEls.current.forEach((el) => { el.pause(); el.currentTime = 0; });
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, totalDuration]);

  // ── Pre-load audio elements when scenes change ─────
  useEffect(() => {
    orderedScenes.forEach((ts) => {
      if (ts.scene.audio_url && !audioEls.current.has(ts.scene.id)) {
        const el = new Audio(ts.scene.audio_url);
        el.preload = 'auto';
        audioEls.current.set(ts.scene.id, el);
      }
    });
    // Cleanup removed scenes
    audioEls.current.forEach((_, id) => {
      if (!orderedScenes.find((ts) => ts.scene.id === id)) {
        audioEls.current.get(id)?.pause();
        audioEls.current.delete(id);
      }
    });
  }, [orderedScenes]);

  // ── Track active scene from currentTime ────────────
  useEffect(() => {
    if (orderedScenes.length === 0) return;
    const active = orderedScenes.find(
      (ts) => currentTime >= ts.startTime && currentTime < ts.endTime
    );
    const newActiveId = active?.scene.id ?? null;
    setActiveScene(newActiveId);
  }, [currentTime, orderedScenes]);

  // ── Audio: play when scene changes ────────────────
  useEffect(() => {
    if (!isPlaying || activeSceneId === lastActiveSceneIdRef.current) return;
    lastActiveSceneIdRef.current = activeSceneId;

    // Stop all previous audio
    stopSpeech();
    audioEls.current.forEach((el, id) => {
      if (id !== activeSceneId) { el.pause(); el.currentTime = 0; }
    });

    if (!activeSceneId) return;
    const activeTs = orderedScenes.find((ts) => ts.scene.id === activeSceneId);
    if (!activeTs) return;
    const scene = activeTs.scene;

    if (scene.audio_url && scene.audio_status === 'done') {
      // Priority 1: real audio file from audio_server
      let el = audioEls.current.get(activeSceneId);
      if (!el || el.src !== scene.audio_url) {
        el = new Audio(scene.audio_url);
        audioEls.current.set(activeSceneId, el);
      }
      el.currentTime = 0;
      el.play().catch(() => {
        if (scene.narration) speakText(scene.narration);
      });
    } else if (scene.narration) {
      // Fallback: browser speech synthesis
      speakText(scene.narration);
    }
  }, [activeSceneId, isPlaying]);

  // ── Cleanup on unmount ─────────────────────────────
  useEffect(() => {
    return () => {
      stopSpeech();
      audioEls.current.forEach((el) => { el.pause(); });
      audioEls.current.clear();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
}
