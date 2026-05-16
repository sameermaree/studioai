import { useState, useCallback } from 'react';
import {
  Trash2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Sparkles,
  Save,
  Image as ImageIcon,
  Loader2,
  X,
  ExternalLink,
} from 'lucide-react';
import type { LocationBibleEntry } from '../../../types';
import type { GenerationStatus } from '../../../types/generation';
import { useGenerationStore } from '../../../store/useGenerationStore';
import { GenerationProgress } from '../../../components/ui/GenerationProgress';

const LOCATION_TYPES = [
  { value: 'location', label: 'General Location' },
  { value: 'educational', label: 'Educational (school, classroom)' },
  { value: 'home', label: 'Home (house, room)' },
  { value: 'outdoor', label: 'Outdoor (park, playground)' },
  { value: 'urban', label: 'Urban (street, market)' },
  { value: 'nature', label: 'Nature (forest, river)' },
  { value: 'religious', label: 'Religious (mosque, church)' },
  { value: 'fantasy', label: 'Fantasy / Imaginary' },
  { value: 'interior', label: 'Interior (generic)' },
];

interface StoryLocationCardProps {
  entry: LocationBibleEntry;
  onUpdate: (updates: Partial<LocationBibleEntry>) => void;
  onDelete: () => void;
}

export function StoryLocationCard({ entry, onUpdate, onDelete }: StoryLocationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Global generation progress
  const genProgress = useGenerationStore((s) => s.progress);
  const genSetProgress = useGenerationStore((s) => s.setProgress);
  const genResetProgress = useGenerationStore((s) => s.resetProgress);

  const promptKey: `generate-location-prompt-${string}` = `generate-location-prompt-${entry.id}`;
  const imageKey: `generate-location-image-${string}` = `generate-location-image-${entry.id}`;
  const genRunning = genProgress[promptKey]?.status === 'generating' || genProgress[promptKey]?.status === 'queued' || genProgress[promptKey]?.status === 'saving'
    || genProgress[imageKey]?.status === 'generating' || genProgress[imageKey]?.status === 'queued' || genProgress[imageKey]?.status === 'saving';

  const handleGeneratePrompt = useCallback(() => {
    genSetProgress(promptKey, { status: 'generating', progress: 30, label: 'Generating location prompt...' });

    try {
      // Build a location prompt from structured fields
      const parts: string[] = [
        entry.visual_description,
        entry.layout_description,
        entry.fixed_objects ? `containing ${entry.fixed_objects}` : '',
        entry.lighting ? `${entry.lighting} lighting` : '',
        entry.color_palette ? `${entry.color_palette} color palette` : '',
        entry.mood ? `${entry.mood} mood` : '',
        'bright clean educational interior',
        'warm daylight, soft shadows',
        'pastel educational style',
        'high quality, detailed environment',
        'no characters, empty room',
      ].filter(Boolean);

      const locationPrompt = parts.join(', ');
      const sceneInject = entry.visual_description;
      const negPrompt = 'deformed, ugly, blurry, low quality, distorted, people, characters, text, watermark';

      genSetProgress(promptKey, { status: 'saving', progress: 85, label: 'Saving prompt...' });
      onUpdate({
        location_prompt: locationPrompt,
        scene_injection_prompt: sceneInject,
        negative_prompt: negPrompt,
      });
      genSetProgress(promptKey, { status: 'done', progress: 100, label: 'Prompt ready' });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      genSetProgress(promptKey, { status: 'failed', progress: 0, label: 'Failed', error: errMsg });
    } finally {
      setTimeout(() => genResetProgress(promptKey), 3000);
    }
  }, [entry, onUpdate, promptKey, genSetProgress, genResetProgress]);

  const handleGenerateImage = useCallback(async () => {
    genSetProgress(imageKey, { status: 'queued', progress: 10, label: 'Queuing image generation...' });

    try {
      const { generateLocationImage } = await import('../../../services/generation/LocationImageGenerator');

      const result = await generateLocationImage(entry, (progressState) => {
        const { percentage, phase, error } = progressState;
        let status: GenerationStatus = 'generating';
        let label = phase;

        if (progressState.isDone) {
          status = 'done';
          label = 'Image ready';
        } else if (error) {
          status = 'failed';
          label = error;
        } else if (percentage <= 10) {
          status = 'queued';
          label = 'Queued...';
        } else if (percentage <= 40) {
          status = 'generating';
          label = 'Generating...';
        } else if (percentage <= 85) {
          status = 'saving';
          label = 'Saving...';
        }

        genSetProgress(imageKey, { status, progress: percentage, label, error: error ?? undefined });
      });

      if (result.success && result.referenceImagePath) {
        onUpdate({ reference_image_path: result.referenceImagePath });
        genSetProgress(imageKey, { status: 'done', progress: 100, label: 'Image ready' });
      } else {
        genSetProgress(imageKey, { status: 'failed', progress: 0, label: result.error || 'Generation failed', error: result.error });
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      genSetProgress(imageKey, { status: 'failed', progress: 0, label: 'Failed', error: errMsg });
    } finally {
      setTimeout(() => genResetProgress(imageKey), 5000);
    }
  }, [entry, onUpdate, imageKey, genSetProgress, genResetProgress]);

  const handleSave = useCallback(() => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1000);
  }, []);

  return (
    <div className="border border-surface-border rounded-lg overflow-hidden bg-surface">
      <div
        className="flex items-center gap-2 p-2 cursor-pointer hover:bg-surface-lighter transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-8 h-8 rounded-lg bg-studio-800 flex items-center justify-center text-xs font-bold text-studio-400 shrink-0 overflow-hidden">
          {entry.reference_image_path ? (
            <img src={entry.reference_image_path} alt={entry.name} className="w-full h-full object-cover rounded-lg" />
          ) : (
            <MapPin className="w-4 h-4 text-studio-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{entry.name}</p>
          <p className="text-xs text-studio-400 truncate">{entry.type}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded hover:bg-danger-900/30 text-studio-400 hover:text-danger-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-studio-500" /> : <ChevronDown className="w-3.5 h-3.5 text-studio-500" />}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-surface-border space-y-2">
          {/* Row 1: Name, Type */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-[10px]">Name</label>
              <input value={entry.name} onChange={(e) => onUpdate({ name: e.target.value })} className="input text-xs py-1" />
            </div>
            <div>
              <label className="label text-[10px]">Type</label>
              <select value={entry.type} onChange={(e) => onUpdate({ type: e.target.value })} className="input text-xs py-1">
                {LOCATION_TYPES.map((lt) => (
                  <option key={lt.value} value={lt.value}>{lt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Visual Description */}
          <div>
            <label className="label text-[10px]">Visual Description</label>
            <textarea value={entry.visual_description} onChange={(e) => onUpdate({ visual_description: e.target.value })} className="input text-xs min-h-[40px] resize-y" />
          </div>

          {/* Layout Description */}
          <div>
            <label className="label text-[10px]">Layout Description</label>
            <textarea value={entry.layout_description} onChange={(e) => onUpdate({ layout_description: e.target.value })} className="input text-xs min-h-[30px] resize-y" placeholder="e.g. desks facing the whiteboard, teacher desk at front" />
          </div>

          {/* Row 2: Fixed Objects, Lighting */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-[10px]">Fixed Objects</label>
              <textarea value={entry.fixed_objects} onChange={(e) => onUpdate({ fixed_objects: e.target.value })} className="input text-xs min-h-[30px] resize-y" placeholder="e.g. whiteboard, bookshelves, posters" />
            </div>
            <div>
              <label className="label text-[10px]">Lighting</label>
              <input value={entry.lighting} onChange={(e) => onUpdate({ lighting: e.target.value })} className="input text-xs py-1" placeholder="e.g. warm daylight" />
            </div>
          </div>

          {/* Row 3: Color Palette, Mood */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-[10px]">Color Palette</label>
              <input value={entry.color_palette} onChange={(e) => onUpdate({ color_palette: e.target.value })} className="input text-xs py-1" placeholder="e.g. pastel, bright colors" />
            </div>
            <div>
              <label className="label text-[10px]">Mood</label>
              <input value={entry.mood} onChange={(e) => onUpdate({ mood: e.target.value })} className="input text-xs py-1" placeholder="e.g. cheerful, cozy" />
            </div>
          </div>

          {/* Reference Image Preview — clickable lightbox */}
          {entry.reference_image_path && (
            <div>
              <label className="label text-[10px]">Reference Image</label>
              <div className="mt-1">
                <img
                  src={entry.reference_image_path}
                  alt={entry.name}
                  className="w-20 h-20 object-cover rounded-lg border border-surface-border cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setLightboxOpen(true)}
                />
              </div>
            </div>
          )}
          {/* Lightbox modal for full preview */}
          {lightboxOpen && entry.reference_image_path && (
            <div
              className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
              onClick={() => setLightboxOpen(false)}
            >
              <div
                className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setLightboxOpen(false)}
                  className="absolute -top-10 right-0 p-1 text-white/70 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <img
                  src={entry.reference_image_path}
                  alt={entry.name}
                  className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                />
                <div className="mt-3 flex items-center gap-3">
                  <p className="text-sm text-white/70">{entry.name}</p>
                  <a
                    href={entry.reference_image_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-accent-600/30 text-accent-300 hover:bg-accent-600/50 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open in new tab
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Generation Progress Indicators */}
          {genProgress[promptKey] && (
            <div className="px-1">
              <GenerationProgress progress={genProgress[promptKey]} compact />
            </div>
          )}
          {genProgress[imageKey] && (
            <div className="px-1">
              <GenerationProgress progress={genProgress[imageKey]} compact />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1 border-t border-surface-border">
            <button
              type="button"
              onClick={handleGeneratePrompt}
              disabled={genRunning}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-accent-600/20 text-accent-400 hover:bg-accent-600/30 transition-colors flex items-center gap-1 disabled:opacity-40"
            >
              <Sparkles className="w-3 h-3" />
              Generate Prompt
            </button>
            <button
              type="button"
              onClick={handleSave}
              className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                isSaving ? 'bg-emerald-600/20 text-emerald-400' : 'bg-surface-light text-studio-300 hover:bg-surface-border'
              }`}
            >
              <Save className="w-3 h-3" />
              {isSaving ? 'Saved!' : 'Save Location'}
            </button>
            <button
              type="button"
              disabled={!entry.location_prompt || genRunning}
              onClick={handleGenerateImage}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-surface-light text-studio-300 hover:bg-surface-border transition-colors flex items-center gap-1 disabled:opacity-40"
            >
              <ImageIcon className="w-3 h-3" />
              Generate Image
            </button>
          </div>

          {/* Prompts */}
          <div>
            <label className="label text-[10px]">Location Prompt</label>
            <textarea value={entry.location_prompt} onChange={(e) => onUpdate({ location_prompt: e.target.value })} className="input text-xs min-h-[30px] resize-y font-mono" />
          </div>
          <div>
            <label className="label text-[10px]">Scene Injection Prompt</label>
            <textarea value={entry.scene_injection_prompt} onChange={(e) => onUpdate({ scene_injection_prompt: e.target.value })} className="input text-xs min-h-[30px] resize-y font-mono" />
          </div>
          <div>
            <label className="label text-[10px]">Negative Prompt</label>
            <textarea value={entry.negative_prompt} onChange={(e) => onUpdate({ negative_prompt: e.target.value })} className="input text-xs min-h-[30px] resize-y font-mono" />
          </div>

          {/* Seed */}
          <div>
            <label className="label text-[10px]">Seed</label>
            <input type="number" value={entry.seed || ''} onChange={(e) => onUpdate({ seed: e.target.value ? parseInt(e.target.value) : null })} className="input text-xs py-1 font-mono" />
          </div>
        </div>
      )}
    </div>
  );
}
