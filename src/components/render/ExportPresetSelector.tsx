import React from 'react';
import { Youtube, Instagram, Mail, MonitorPlay, Settings } from 'lucide-react';

export type ExportPreset = 'youtube' | 'tiktok' | 'instagram' | 'custom';
export type AspectRatio = '16:9' | '9:16' | '1:1';
export type Quality = 'low' | 'medium' | 'high' | 'max';
export type VideoFormat = 'mp4' | 'webm' | 'mov' | 'gif';

interface PresetDetails {
  name: string;
  description: string;
  icon: React.ElementType;
  resolution: string;
  aspectRatio: AspectRatio;
  format: VideoFormat;
  quality: Quality;
}

const PRESETS: Record<ExportPreset, PresetDetails> = {
  youtube: {
    name: 'YouTube',
    description: 'Optimized for YouTube upload',
    icon: Youtube,
    resolution: '1920×1080',
    aspectRatio: '16:9',
    format: 'mp4',
    quality: 'high'
  },
  tiktok: {
    name: 'TikTok/Reels',
    description: 'Vertical video for social media',
    icon: MonitorPlay,
    resolution: '1080×1920',
    aspectRatio: '9:16',
    format: 'mp4',
    quality: 'high'
  },
  instagram: {
    name: 'Instagram',
    description: 'Square format for Instagram',
    icon: Instagram,
    resolution: '1080×1080',
    aspectRatio: '1:1',
    format: 'mp4',
    quality: 'high'
  },
  custom: {
    name: 'Custom',
    description: 'Custom export settings',
    icon: Settings,
    resolution: 'Custom',
    aspectRatio: '16:9',
    format: 'mp4',
    quality: 'high'
  }
};

interface ExportPresetSelectorProps {
  selectedPreset: ExportPreset;
  onSelectPreset: (preset: ExportPreset) => void;
  className?: string;
}

const ExportPresetSelector: React.FC<ExportPresetSelectorProps> = ({
  selectedPreset,
  onSelectPreset,
  className
}) => {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${className || ''}`}>
      {Object.entries(PRESETS).map(([presetId, preset]) => {
        const isSelected = presetId === selectedPreset;
        const Icon = preset.icon;
        
        return (
          <div 
            key={presetId}
            className={`p-4 rounded-lg bg-surface border ${isSelected 
              ? 'border-accent-500 bg-accent-900/20' 
              : 'border-surface-border hover:border-accent-600/30'} 
              transition-colors cursor-pointer`}
            onClick={() => onSelectPreset(presetId as ExportPreset)}
          >
            <div className="flex justify-between items-start mb-2">
              <Icon className={`w-5 h-5 ${isSelected ? 'text-accent-400' : 'text-studio-400'}`} />
              {isSelected && (
                <div className="bg-accent-500 text-accent-950 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                  Selected
                </div>
              )}
            </div>
            <p className={`text-sm font-medium ${isSelected ? 'text-accent-400' : 'text-white'}`}>
              {preset.name}
            </p>
            <p className="text-xs text-studio-500 mt-1">{preset.description}</p>
            <div className="flex gap-2 mt-2">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-studio-800 text-studio-300">
                {preset.resolution}
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-studio-800 text-studio-300">
                {preset.aspectRatio}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ExportPresetSelector;