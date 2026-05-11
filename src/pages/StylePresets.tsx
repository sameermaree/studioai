import { useState } from 'react';
import { Eye, Camera, Lightbulb, Copy, Sparkles } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { systemStylePresets } from '../data/stylePresets';
import type { StylePreset } from '../types';

export function StylePresets() {
  const { t } = useLanguage();
  const [selectedPreset, setSelectedPreset] = useState<StylePreset | null>(null);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="section-header">
        <div>
          <h1 className="page-title">{t.styles.title}</h1>
          <p className="page-subtitle">{t.styles.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {systemStylePresets.map((preset) => (
          <div
            key={preset.id}
            onClick={() => setSelectedPreset(preset)}
            className={`card-hover cursor-pointer ${selectedPreset?.id === preset.id ? 'border-accent-600/60' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 rounded-lg bg-studio-800 overflow-hidden shrink-0">
                {preset.thumbnail_url && (
                  <img src={preset.thumbnail_url} alt={preset.name} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white">{(t.styles.names as Record<string, string>)[preset.id] || preset.name}</h3>
                <p className="text-xs text-studio-400 mt-0.5 line-clamp-2">{preset.description}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-1.5">
              {preset.color_palette.map((color) => (
                <div key={color} className="w-5 h-5 rounded-full border border-surface-border" style={{ backgroundColor: color }} />
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="badge-accent text-[10px]">{preset.category.replace('_', ' ')}</span>
              {preset.is_system && <span className="badge-blue text-[10px]">System</span>}
            </div>
          </div>
        ))}
      </div>

      {selectedPreset && (
        <PresetDetail preset={selectedPreset} onClose={() => setSelectedPreset(null)} />
      )}
    </div>
  );
}

function PresetDetail({ preset, onClose }: { preset: StylePreset; onClose: () => void }) {
  const { t } = useLanguage();
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-studio-800 overflow-hidden">
              {preset.thumbnail_url && (
                <img src={preset.thumbnail_url} alt={preset.name} className="w-full h-full object-cover" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{(t.styles.names as Record<string, string>)[preset.id] || preset.name}</h2>
              <p className="text-sm text-studio-400 mt-0.5">{preset.description}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="badge-accent">{preset.category.replace('_', ' ')}</span>
                <span className="text-xs text-studio-500">{preset.cinematic_mood}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost">{t.common.close}</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailSection icon={Lightbulb} title={t.styles.lightingRules} content={preset.lighting_rules} onCopy={() => copyToClipboard(preset.lighting_rules)} />
          <DetailSection icon={Camera} title={t.styles.cameraStyle} content={preset.camera_style} onCopy={() => copyToClipboard(preset.camera_style)} />
          <DetailSection icon={Eye} title={t.styles.renderingStyle} content={preset.rendering_style} onCopy={() => copyToClipboard(preset.rendering_style)} />
          <DetailSection icon={Sparkles} title={t.styles.characterGuidance} content={preset.character_guidance} onCopy={() => copyToClipboard(preset.character_guidance)} />
        </div>

        <div className="mt-4">
          <h4 className="text-sm font-medium text-studio-300 mb-2">{t.styles.colorPalette}</h4>
          <div className="flex items-center gap-2">
            {preset.color_palette.map((color) => (
              <div key={color} className="group relative">
                <div className="w-10 h-10 rounded-lg border border-surface-border cursor-pointer hover:scale-110 transition-transform" style={{ backgroundColor: color }} />
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-studio-500 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                  {color}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <h4 className="text-sm font-medium text-studio-300 mb-2">{t.styles.negativePrompts}</h4>
          <div className="p-3 rounded-lg bg-surface text-sm text-danger-400/80 font-mono">
            {preset.negative_prompts}
          </div>
        </div>

        <div className="mt-4">
          <h4 className="text-sm font-medium text-studio-300 mb-2">{t.styles.samplePrompts}</h4>
          <div className="space-y-2">
            {preset.sample_prompts.map((prompt, i) => (
              <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-surface">
                <p className="text-sm text-studio-300 font-mono flex-1">{prompt}</p>
                <button
                  onClick={() => copyToClipboard(prompt)}
                  className="p-1 text-studio-500 hover:text-accent-400 transition-colors shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailSection({ icon: Icon, title, content, onCopy }: { icon: React.ElementType; title: string; content: string; onCopy: () => void }) {
  return (
    <div className="p-4 rounded-lg bg-surface border border-surface-border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-accent-500" />
          <h4 className="text-xs font-medium text-studio-300">{title}</h4>
        </div>
        <button onClick={onCopy} className="p-1 text-studio-500 hover:text-accent-400 transition-colors">
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-sm text-studio-200">{content}</p>
    </div>
  );
}
