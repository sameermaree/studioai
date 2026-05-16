import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ComfyUIService } from '../services/comfyui';
import { WorkflowTemplate } from '../infrastructure/ai/services/ComfyUIOrchestrator';
import { useStudioStore } from '../store/useStudioStore';
import { BatchGenerator } from '../services/comfyui/batchGenerator';
import { injectCharacterConsistency } from '../services/character/CharacterPromptBuilder';
import type { Scene, Character } from '../types';

const labels = {
  ar: {
    title: 'استوديو الذكاء الاصطناعي',
    subtitle: 'توليد صور المشاهد باستخدام ComfyUI',
    template: 'قالب سير العمل',
    prompt: 'الوصف (Prompt)',
    negativePrompt: 'الوصف السلبي (Negative Prompt)',
    width: 'العرض', height: 'الارتفاع', seed: 'بذرة التوليد (Seed)',
    cfg: 'CFG Scale', steps: 'عدد الخطوات',
    generate: 'توليد الصورة', generating: 'جارٍ التوليد...',
    stop: 'إيقاف', reset: 'إعادة تعيين',
    selectTemplate: 'اختر قالباً...',
    episode: 'الحلقة', scene: 'المشهد',
    selectEpisode: 'اختر حلقة...', selectScene: 'اختر مشهداً...',
    injectPrompt: 'استخدام برومبت المشهد',
    sceneImagePrompt: 'برومبت الصورة',
    sceneVideoMotion: 'برومبت الحركة (فيديو)',
    sceneNarration: 'نص السرد', sceneSubtitles: 'النص الترجمة',
    renderStatus: 'حالة التوليد', markApproved: 'اعتماد المشهد',
    assetsGalleryDisabled: 'معرض الأصول - قريباً',     advancedModeDisabled: 'الوضع المتقدم - قريباً',
    statusOnline: 'متصل', statusOffline: 'غير متصل',
    workflowLoaded: 'محمل', workflowNotLoaded: 'غير محمل',
    refresh: 'تحديث',
    pipelineImage: 'الصورة',
    pipelineVideo: 'الفيديو',
    pipelineVoice: 'الصوت',
    pipelineLipSync: 'تحريك الشفاه',
    pipelineSubtitles: 'الترجمة',
    pipelineExport: 'التصدير',
    comingSoon: 'قريباً',
    generateVideoDisabled: 'توليد الفيديو - قريباً',
    generateVoiceDisabled: 'توليد الصوت - قريباً',
    generateLipSyncDisabled: 'تحريك الشفاه - قريباً',
    generateSubtitlesDisabled: 'تحضير الترجمة - قريباً',
    generateAll: 'توليد جميع صور المشاهد',
    charactersSection: 'الشخصيات في هذا المشهد',
    characterName: 'الاسم',
    characterOutfit: 'اللباس',
    characterConsistency: 'ثبات الشخصية',
    useCharacterPrompt: 'حقن وصف الشخصيات',
    noEpisodes: 'لا توجد حلقات. أنشئ حلقة أولاً.', error: 'خطأ',
  },
  en: {
    title: 'AI Studio',
    subtitle: 'Generate scene images using ComfyUI',
    template: 'Workflow Template', prompt: 'Prompt',
    negativePrompt: 'Negative Prompt',
    width: 'Width', height: 'Height', seed: 'Seed',
    cfg: 'CFG Scale', steps: 'Steps',
    generate: 'Generate Image', generating: 'Generating...',
    stop: 'Stop', reset: 'Reset',
    selectTemplate: 'Select a template...',
    episode: 'Episode', scene: 'Scene',
    selectEpisode: 'Select episode...', selectScene: 'Select scene...',
    injectPrompt: 'Use Scene Prompt',
    sceneImagePrompt: 'Image Prompt',
    sceneVideoMotion: 'Video Motion Prompt',
    sceneNarration: 'Narration', sceneSubtitles: 'Subtitles',
    renderStatus: 'Render Status', markApproved: 'Mark Approved',
    assetsGalleryDisabled: 'Assets Gallery - Coming Soon',     advancedModeDisabled: 'Advanced Mode - Coming Soon',
    statusOnline: 'Online', statusOffline: 'Offline',
    workflowLoaded: 'Loaded', workflowNotLoaded: 'Not Loaded',
    refresh: 'Refresh',
    pipelineImage: 'Image',
    pipelineVideo: 'Video',
    pipelineVoice: 'Voice',
    pipelineLipSync: 'Lip Sync',
    pipelineSubtitles: 'Subtitles',
    pipelineExport: 'Export',
    comingSoon: 'Coming Soon',
    generateVideoDisabled: 'Generate Video - Coming Soon',
    generateVoiceDisabled: 'Generate Voice - Coming Soon',
    generateLipSyncDisabled: 'Lip Sync - Coming Soon',
    generateSubtitlesDisabled: 'Prepare Subtitles - Coming Soon',
    generateAll: 'Generate All Scene Images',
    charactersSection: 'Characters in this Scene',
    characterName: 'Name',
    characterOutfit: 'Outfit',
    characterConsistency: 'Character Consistency',
    useCharacterPrompt: 'Inject Character Descriptions',
    noEpisodes: 'No episodes. Create one first.', error: 'Error',
  }
};

type Lang = 'ar' | 'en';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800', queued: 'bg-blue-100 text-blue-800',
  rendering: 'bg-indigo-100 text-indigo-800', completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};
const statusAr: Record<string, string> = {
  pending: 'معلق', queued: 'في الانتظار', rendering: 'قيد التوليد',
  completed: 'مكتمل', failed: 'فشل',
};

const StatusBadge: React.FC<{ status: Scene['render_status']; lang: Lang }> = ({ status, lang }) => (
  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[status] || 'bg-gray-100'}`}>
    {lang === 'ar' ? (statusAr[status] || status) : status}
  </span>
);

const ComfyUIStudio: React.FC = () => {
  const [lang, setLang] = useState<Lang>('ar');
  const t = labels[lang];

  const mountedRef = useRef(true);

  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [cfg, setCfg] = useState(7);
  const [steps, setSteps] = useState(30);

  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<{comfyui: boolean; backend: boolean; workflow: boolean}>({comfyui: false, backend: false, workflow: false});

  const characters = useStudioStore((s) => s.characters);
  const episodes = useStudioStore((s) => s.episodes);
  const updateEpisode = useStudioStore((s) => s.updateEpisode);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState('');
  const [selectedSceneId, setSelectedSceneId] = useState('');

  const selectedEpisode = episodes.find((e) => e.id === selectedEpisodeId);
  const scenes = selectedEpisode?.scenes ?? [];
  const selectedScene = scenes.find((s) => s.id === selectedSceneId);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Set fallback templates immediately
      const fallback: WorkflowTemplate[] = [
        {
          id: 'default-txt2img',
          name: 'SDXL Text to Image',
          description: 'Standard text to image workflow',
          path: 'workflows/sdxl_txt2img.json',
          type: 'txt2img',
          inputNodes: { promptNode: '6', negativePromptNode: '7', sizeNode: '5', seedNode: '3' },
          outputNodes: { imageNode: '9' },
          parameterMapping: { prompt: 'text', negative_prompt: 'text', width: 'width', height: 'height', seed: 'seed' },
          metadata: { model: 'SDXL', steps: 30 },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      if (!cancelled) setTemplates(fallback);
      if (!cancelled) setSelectedTemplate('default-txt2img');

      // Set initial status: backend is ready (app running), templates set via fallback above
      if (!cancelled) setConnectionStatus(s => ({ ...s, backend: true }));
      if (!cancelled) setConnectionStatus(s => ({ ...s, workflow: true }));

      // STEP 1 (IMMEDIATE): Direct fetch for ComfyUI connection status
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('http://127.0.0.1:8188/system_stats', { signal: controller.signal });
        clearTimeout(timeoutId);
        const online = res.ok;
        console.log('[COMFYUI UI] Fetch status:', res.status, 'online =', online);
        if (!cancelled) {
          setConnectionStatus(s => ({ ...s, comfyui: online }));
        }
        if (online) {
          try {
            const data = await res.clone().json();
            const devices = data?.devices || [];
            const hasCuda = devices.some((d: any) => d.type === 'cuda' || (d.name && d.name.toLowerCase().includes('cuda')));
            if (hasCuda && devices.length > 0) console.log('[COMFYUI UI] GPU:', devices[0].name);
          } catch {/* ignore */}
        }
      } catch (err: any) {
        console.log('[COMFYUI UI] Fetch failed:', err?.message);
        if (!cancelled) {
          setConnectionStatus(s => ({ ...s, comfyui: false }));
        }
      }

      // Step 2 (BACKGROUND): Try ComfyUI service init for templates
      try {
        const svc = ComfyUIService.getInstance();
        await svc.initialize({
          baseUrl: 'http://127.0.0.1:8188',
        }, undefined, undefined, {
          workflowTemplatesPath: './workflows'
        });
        if (cancelled) return;
        const available = svc.getWorkflowTemplates();
        if (available.length > 0) {
          if (!cancelled) setTemplates(available);
          if (!cancelled) setConnectionStatus(s => ({ ...s, workflow: true }));
          const sdxl = available.find((t) => t.id === 'sdxl-txt2img')
            || available.find((t) => t.type === 'txt2img');
          if (sdxl && !cancelled) setSelectedTemplate(sdxl.id);
        }
      } catch (_err) {
        // Service init failed but UI can still work with fallback
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const isProcessingRef = useRef(false);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) { setError('Please enter a prompt'); return; }
    if (!selectedTemplate) { setError('Please select a template'); return; }
    // Prevent double-click while generation is in progress
    if (isProcessingRef.current) { console.log('[GENERATE] Already processing, ignoring click'); return; }
    isProcessingRef.current = true;

    setError(null);
    setResult(null);
    setProgress(0);
    setIsGenerating(true);

    try {
      const svc = ComfyUIService.getInstance();
      const { job } = await svc.generateImage(prompt, {
        negativePrompt, width, height, seed,
        templateId: selectedTemplate,
        parameters: { cfg, steps },
        callbacks: {
          onProgress: (p) => { if (mountedRef.current) setProgress(p); },
          onSuccess: (res) => {
            if (!mountedRef.current) return;
            setResult(res);
            setProgress(100);
            setIsGenerating(false);
            isProcessingRef.current = false;
            console.log('[GENERATE] Success, result URL:', res.asset?.url || res.url);
          },
          onError: (err) => {
            if (!mountedRef.current) return;
            setError(err.message);
            setIsGenerating(false);
            isProcessingRef.current = false;
          },
        },
      });
      console.log('[COMFYUI] Job queued:', job.id);
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err?.message || 'Generation failed');
        setIsGenerating(false);
      }
      isProcessingRef.current = false;
    }
    // Note: NO finally block — callbacks or catch handle isGenerating reset
  }, [prompt, negativePrompt, width, height, seed, cfg, steps, selectedTemplate]);

  const handleStop = useCallback(() => { setIsGenerating(false); setProgress(0); }, []);
  const handleReset = useCallback(() => {
    setPrompt(''); setNegativePrompt(''); setWidth(1024); setHeight(1024);
    setSeed(undefined); setCfg(7); setSteps(30);
    setError(null); setResult(null); setProgress(0); setIsGenerating(false);
  }, []);

  const handleInjectScenePrompt = useCallback(() => {
    if (!selectedScene) return;

    // Use the professional CharacterPromptBuilder for consistency
    const sceneChars = characters.filter((ch) => selectedScene.characters.includes(ch.id));
    const { prompt: enhancedPrompt, negative: enhancedNegative } = injectCharacterConsistency(
      selectedScene.prompt_text || '',
      sceneChars
    );

    setPrompt(enhancedPrompt);
    setNegativePrompt(enhancedNegative || selectedScene.negative_prompt || '');
    if (selectedScene.seed) setSeed(selectedScene.seed);
  }, [selectedScene, characters]);

  const handleGenerateAll = useCallback(async () => {
    console.log('[BATCH] button clicked');
    if (!selectedEpisode || !selectedTemplate) {
      console.log('[BATCH] abort: no episode or template');
      return;
    }
    setIsGenerating(true);
    setError(null);

    const sortedScenes = selectedEpisode.scenes
      .slice()
      .sort((a, b) => a.order - b.order);

    console.log('[BATCH] scenes count:', sortedScenes.length);

    for (let i = 0; i < sortedScenes.length; i++) {
      const sc = sortedScenes[i];
      if (!sc.prompt_text?.trim()) {
        console.log('[BATCH] skip scene', sc.order, ': no prompt_text');
        continue;
      }

      setProgress(Math.round(((i) / sortedScenes.length) * 100));

      try {
        // Build the full prompt with character consistency for this scene
        const sceneChars = characters.filter((ch) => sc.characters.includes(ch.id));
        const { prompt: finalPrompt, negative: finalNegative } = injectCharacterConsistency(
          sc.prompt_text,
          sceneChars
        );

        console.log('[BATCH] enqueue scene id', sc.id, 'title:', sc.title);

        const svc = ComfyUIService.getInstance();

        // Use a promise to wait for generation result so we can attach the URL
        const result = await new Promise<any>((resolve, reject) => {
          svc.generateImage(finalPrompt, {
            negativePrompt: finalNegative || sc.negative_prompt || '',
            width, height, seed: sc.seed || undefined,
            templateId: selectedTemplate,
            parameters: { cfg, steps },
            callbacks: {
              onSuccess: (res) => {
                console.log('[BATCH] generated image for scene id', sc.id, 'url:', res.asset?.url || res.url);
                resolve(res);
              },
              onError: (err) => {
                console.log('[BATCH] failed scene id', sc.id, 'error:', err.message);
                reject(err);
              },
            },
          });
        });

        const imgUrl = result.asset?.url || result.url;
        if (imgUrl) {
          // Attach the generated image URL to the correct scene — read latest episode state
          const ep = useStudioStore.getState().episodes.find(e => e.id === selectedEpisode.id);
          if (ep) {
            const updatedScenes = ep.scenes.map((s) =>
              s.id === sc.id
                ? { ...s, render_url: imgUrl, render_status: 'completed' as const }
                : s
            );
            useStudioStore.getState().updateEpisode(selectedEpisode.id, { scenes: updatedScenes });
          }
        }
      } catch (err: any) {
        console.log('[BATCH] failed scene id', sc.id, 'error:', err?.message);
        // Mark scene as failed
        const ep = useStudioStore.getState().episodes.find(e => e.id === selectedEpisode.id);
        if (ep) {
          const updatedScenes = ep.scenes.map((s) =>
            s.id === sc.id
              ? { ...s, render_status: 'failed' as const }
              : s
          );
          useStudioStore.getState().updateEpisode(selectedEpisode.id, { scenes: updatedScenes });
        }
      }
    }

    console.log('[BATCH] complete');
    setProgress(100);
    setIsGenerating(false);
  }, [selectedEpisode, selectedTemplate, width, height, cfg, steps, characters]);

  const handleMarkApproved = useCallback(() => {
    if (!selectedEpisode || !selectedScene) return;
    updateEpisode(selectedEpisode.id, {
      scenes: selectedEpisode.scenes.map((s) =>
        s.id === selectedScene.id
          ? { ...s, metadata: { ...s.metadata, approved: true } as Record<string, unknown> }
          : s
      ),
    });
  }, [selectedEpisode, selectedScene, updateEpisode]);

  const pipelinePhases = [
    { key: 'image', label: t.pipelineImage, status: 'ready' as const },
    { key: 'video', label: t.pipelineVideo, status: 'disabled' as const },
    { key: 'voice', label: t.pipelineVoice, status: 'disabled' as const },
    { key: 'lipsync', label: t.pipelineLipSync, status: 'disabled' as const },
    { key: 'subtitles', label: t.pipelineSubtitles, status: 'disabled' as const },
    { key: 'export', label: t.pipelineExport, status: 'disabled' as const },
  ];

  const sceneCharacters = React.useMemo(() => {
    if (!selectedScene) return [];
    return characters.filter((ch: Character) => selectedScene.characters.includes(ch.id));
  }, [selectedScene, characters]);

  const filteredTemplates = React.useMemo(
    () => templates.filter((t) => t.type === 'txt2img' || t.type === 'img2img'),
    [templates],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="container mx-auto p-4 max-w-7xl">
        <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">{t.title}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang((l) => (l === 'ar' ? 'en' : 'ar'))}
              className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700">
              {lang === 'ar' ? 'English' : 'العربية'}
            </button>
            <button disabled className="px-3 py-1.5 text-sm rounded bg-gray-400 text-white cursor-not-allowed">{t.assetsGalleryDisabled}</button>
            <button disabled className="px-3 py-1.5 text-sm rounded bg-gray-400 text-white cursor-not-allowed">{t.advancedModeDisabled}</button>
          </div>
        </div>

        
        {/* Connection Status Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {console.log('[COMFYUI CARD STATE] connectionStatus.comfyui =', connectionStatus.comfyui)}
          <div className={`rounded-xl p-3 text-sm border ${connectionStatus.comfyui ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700'}`}>
            <p className="text-xs font-medium text-gray-500 mb-1">ComfyUI</p>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connectionStatus.comfyui ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className={connectionStatus.comfyui ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>{connectionStatus.comfyui ? t.statusOnline : t.statusOffline}</span>
            </div>
          </div>
          <div className={`rounded-xl p-3 text-sm border ${connectionStatus.backend ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700'}`}>
            <p className="text-xs font-medium text-gray-500 mb-1">Backend</p>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connectionStatus.backend ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className={connectionStatus.backend ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>{connectionStatus.backend ? t.statusOnline : t.statusOffline}</span>
            </div>
          </div>
          <div className={`rounded-xl p-3 text-sm border ${connectionStatus.workflow ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700' : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700'}`}>
            <p className="text-xs font-medium text-gray-500 mb-1">{t.template}</p>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connectionStatus.workflow ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
              <span className={connectionStatus.workflow ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'}>{connectionStatus.workflow ? t.workflowLoaded : t.workflowNotLoaded}</span>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.episode}</label>
              <select value={selectedEpisodeId} onChange={(e) => { setSelectedEpisodeId(e.target.value); setSelectedSceneId(''); }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                <option value="">{t.selectEpisode}</option>
                {episodes.map((ep) => (
                  <option key={ep.id} value={ep.id}>{ep.title || `Episode ${ep.id.slice(0, 6)}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.scene}</label>
              <select value={selectedSceneId} onChange={(e) => setSelectedSceneId(e.target.value)}
                disabled={!selectedEpisodeId}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 disabled:opacity-50">
                <option value="">{t.selectScene}</option>
                {scenes.slice().sort((a, b) => a.order - b.order).map((s, i) => (
                  <option key={s.id} value={s.id}>
                    {lang === 'ar' ? `مشهد ${String(i + 1).padStart(2, '0')}` : `Scene ${String(i + 1).padStart(2, '0')}`}
                    {s.title ? ` — ${s.title}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedScene && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={handleInjectScenePrompt}
                className="px-4 py-1.5 text-sm rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200">
                {t.injectPrompt}
              </button>
              <button onClick={handleMarkApproved}
                className="px-4 py-1.5 text-sm rounded-lg bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-200">
                {t.markApproved}
              </button>
              <button onClick={handleGenerateAll}
                className="px-4 py-1.5 text-sm rounded-lg bg-gradient-to-r from-purple-600 to-blue-500 text-white hover:from-purple-700 hover:to-blue-600"
                disabled={!selectedEpisode || !selectedTemplate || isGenerating}>
                {t.generateAll}
              </button>
            </div>
          )}
        </div>

        {selectedScene && (
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {lang === 'ar' ? `مشهد ${String(scenes.findIndex((s) => s.id === selectedScene.id) + 1).padStart(2, '0')}` : `Scene ${String(scenes.findIndex((s) => s.id === selectedScene.id) + 1).padStart(2, '0')}`}
                {selectedScene.title ? ` — ${selectedScene.title}` : ''}
              </h2>
              <StatusBadge status={selectedScene.render_status} lang={lang} />
            </div>

            
          {/* Character Cards */}
          {sceneCharacters.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{t.charactersSection}</p>
              <div className="flex flex-wrap gap-3">
                {sceneCharacters.map((ch: Character) => (
                  <div key={ch.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden shrink-0">
                      {ch.image_url ? (
                        <img src={ch.image_url} alt={ch.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">
                          {ch.name[0]}
                        </div>
                      )}
                    </div>
                    <div className="text-xs">
                      <p className="font-medium text-gray-800 dark:text-gray-200">{ch.name}</p>
                      {ch.outfits?.[0]?.name && (
                        <p className="text-gray-400">{ch.outfits[0].name}</p>
                      )}
                    </div>
                    {ch.consistency_lock && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        {t.characterConsistency}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={handleInjectScenePrompt}
                className="mt-2 px-3 py-1 text-xs rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200">
                {t.useCharacterPrompt}
              </button>
            </div>
          )}

          {/* Pipeline Phase Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {pipelinePhases.map((phase) => {
              const isActive = phase.key === 'image';
              return (
                <span key={phase.key}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 dark:from-purple-900/40 dark:to-blue-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-700'
                      : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 border border-gray-200 dark:border-gray-600'
                  }`}>
                  {phase.label}
                  {!isActive && <span className="ml-1 text-[10px]">({t.comingSoon})</span>}
                </span>
              );
            })}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">{t.sceneImagePrompt}</p>
                <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-4">{selectedScene.prompt_text || '—'}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">{t.sceneVideoMotion} <span className="text-blue-400">(قريباً)</span></p>
                <p className="text-sm text-gray-400 italic">{selectedScene.motion_instructions || '—'}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">{t.sceneNarration} <span className="text-blue-400">(قريباً)</span></p>
                <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-3">{selectedScene.narration || '—'}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">{t.sceneSubtitles} <span className="text-blue-400">(قريباً)</span></p>
                <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-3">{selectedScene.subtitle_text || '—'}</p>
              </div>
            </div>

            {selectedScene.render_url && (
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500 mb-2">{lang === 'ar' ? 'الصورة المولدة' : 'Generated Image'}</p>
                <img src={selectedScene.render_url} alt={selectedScene.prompt_text || ''}
                  className="max-w-full max-h-64 rounded-lg border border-gray-200 dark:border-gray-700" />
              </div>
            )}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-6 mb-6">
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.template}</label>
            <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}
              disabled={isGenerating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 disabled:opacity-50">
              <option value="">{t.selectTemplate}</option>
              {filteredTemplates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name}{tmpl.id === 'sdxl-txt2img' ? ' ★' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.prompt}</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={isGenerating}
              rows={4}
              placeholder={lang === 'ar' ? 'اكتب وصف المشهد هنا...' : 'Enter your scene description here...'}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 disabled:opacity-50 resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.negativePrompt}</label>
            <textarea value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} disabled={isGenerating}
              rows={2}
              placeholder={lang === 'ar' ? 'ما لا تريده في الصورة (اختياري)' : 'What to avoid (optional)'}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 disabled:opacity-50 resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-5">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t.width}</label>
              <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} disabled={isGenerating}
                min={64} max={2048} step={64}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 disabled:opacity-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t.height}</label>
              <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} disabled={isGenerating}
                min={64} max={2048} step={64}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 disabled:opacity-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t.seed}</label>
              <input type="number" value={seed ?? ''} onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : undefined)} disabled={isGenerating}
                placeholder="-1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 disabled:opacity-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t.cfg}</label>
              <input type="number" value={cfg} onChange={(e) => setCfg(Number(e.target.value))} disabled={isGenerating}
                min={1} max={30} step={0.5}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 disabled:opacity-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t.steps}</label>
              <input type="number" value={steps} onChange={(e) => setSteps(Number(e.target.value))} disabled={isGenerating}
                min={1} max={150} step={1}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 disabled:opacity-50" />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              <strong>{t.error}:</strong> {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim() || !selectedTemplate}
              className={`px-6 py-2.5 rounded-lg font-medium text-sm ${
                isGenerating
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-blue-500 text-white hover:from-purple-700 hover:to-blue-600 shadow-sm'
              }`}>
              {isGenerating ? `${t.generating} ${progress}%` : t.generate}
            </button>

            <button onClick={handleStop} disabled={!isGenerating}
              className="px-4 py-2.5 rounded-lg font-medium text-sm bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed">
              {t.stop}
            </button>

            <button onClick={handleReset} disabled={isGenerating}
              className="px-4 py-2.5 rounded-lg font-medium text-sm bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 disabled:opacity-40">
              {t.reset}
            </button>
          </div>

          {isGenerating && (
            <div className="mt-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>

        {result && (
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">{lang === 'ar' ? 'الصورة المولدة' : 'Generated Image'}</h2>
            <div className="flex justify-center">
              {(() => {
                const imgUrl = result.asset?.url || result.url;
                return imgUrl ? (
                  <img
                    key={imgUrl}
                    src={imgUrl}
                    alt={prompt}
                    className="max-w-full max-h-[500px] rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                    onError={(e) => {
                      console.log('[IMAGE] Load error for:', imgUrl);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <p className="text-gray-400 italic">{lang === 'ar' ? 'لا توجد صورة' : 'No image URL'}</p>
                );
              })()}
            </div>
            <div className="mt-4 text-xs text-gray-500 space-y-1">
              <p><strong>{t.prompt}:</strong> {prompt}</p>
              {negativePrompt && <p><strong>{t.negativePrompt}:</strong> {negativePrompt}</p>}
              <p><strong>{t.width}×{t.height}</strong> {seed !== undefined ? `| Seed: ${seed}` : ''} | CFG: {cfg} | Steps: {steps}</p>
            </div>
            
            {/* Action buttons for the generated image */}
            <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={async () => {
                  const imgUrl = result.asset?.url || result.url;
                  if (!imgUrl) { alert('No image URL to save'); return; }
                  try {
                    const asset = {
                      id: crypto.randomUUID(),
                      name: `generated-${Date.now()}`,
                      type: 'image' as const,
                      url: imgUrl,
                      thumbnail_url: imgUrl,
                      tags: ['generated', 'comfyui'],
                      size: 'unknown',
                      mime_type: 'image/png',
                      created_at: new Date().toISOString(),
                    };
                    useStudioStore.getState().addMediaAsset(asset);
                    alert(lang === 'ar' ? '✓ تم حفظ الصورة في المكتبة' : '✓ Image saved to library');
                  } catch (err) {
                    console.error('[SAVE] Failed:', err);
                    alert(lang === 'ar' ? '✗ فشل الحفظ' : '✗ Save failed');
                  }
                }}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 transition-colors"
              >
                {lang === 'ar' ? '💾 حفظ في المكتبة' : '💾 Save to Library'}
              </button>
              
              <button
                onClick={async () => {
                  const imgUrl = result.asset?.url || result.url;
                  if (!imgUrl) { alert('No image URL to attach'); return; }
                  if (!selectedEpisode || !selectedScene) {
                    alert(lang === 'ar' ? 'الرجاء اختيار حلقة ومشهد أولاً' : 'Please select an episode and scene first');
                    return;
                  }
                  try {
                    const updatedScenes = (selectedEpisode.scenes || []).map((s: any) =>
                      s.id === selectedScene.id
                        ? { ...s, render_url: imgUrl, render_status: 'completed' as const }
                        : s
                    );
                    updateEpisode(selectedEpisode.id, { scenes: updatedScenes });
                    alert(lang === 'ar' ? '✓ تم إرفاق الصورة بالمشهد' : '✓ Image attached to scene');
                  } catch (err) {
                    console.error('[ATTACH] Failed:', err);
                    alert(lang === 'ar' ? '✗ فشل الإرفاق' : '✗ Attach failed');
                  }
                }}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 transition-colors"
              >
                {lang === 'ar' ? '🔗 إرفاق بالمشهد' : '🔗 Attach to Scene'}
              </button>
              
              <button
                onClick={() => {
                  const imgUrl = result.asset?.url || result.url;
                  if (!imgUrl) { alert('No image URL to download'); return; }
                  // Download the image directly
                  const link = document.createElement('a');
                  link.href = imgUrl;
                  link.download = `generated-${Date.now()}.png`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50 transition-colors"
              >
                {lang === 'ar' ? '⬇️ تحميل الصورة' : '⬇️ Download Image'}
              </button>
              
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim() || !selectedTemplate}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-40"
              >
                {lang === 'ar' ? '🔄 توليد مجدداً' : '🔄 Regenerate'}
              </button>
            </div>
          </div>
        )}

        {selectedEpisode && scenes.length > 0 && (
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-4">
            <h3 className="text-base font-semibold mb-3">{lang === 'ar' ? 'جميع المشاهد' : 'All Scenes'}</h3>
            <div className="space-y-2">
              {scenes.slice().sort((a, b) => a.order - b.order).map((s, i) => {
                const isSel = s.id === selectedSceneId;
                return (
                  <div key={s.id} onClick={() => setSelectedSceneId(s.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      isSel
                        ? 'bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700'
                        : 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}>
                    <span className="text-xs font-bold text-gray-400 w-8 text-center">{String(i + 1).padStart(2, '0')}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.title || `Scene ${String(i + 1).padStart(2, '0')}`}</p>
                      <p className="text-xs text-gray-400 truncate">{s.prompt_text || '—'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={s.render_status} lang={lang} />
                      {s.render_url && (
                        <img src={s.render_url} alt="" className="w-10 h-10 rounded object-cover border border-gray-200" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {episodes.length === 0 && (
          <div className="text-center py-16 text-gray-400"><p className="text-lg">{t.noEpisodes}</p></div>
        )}
      </div>
    </div>
  );
};

export default ComfyUIStudio;