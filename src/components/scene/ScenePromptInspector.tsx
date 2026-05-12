import { Copy, Download, Lock, Unlock, RefreshCw, Image, Video } from 'lucide-react';
import type { Scene, Character, StylePreset } from '../../types';
import { composeScenePrompt } from '../../services/scene/ScenePromptComposer';
import { 
  lockScene, 
  unlockScene, 
  canRegenerateScene, 
  copyScenePromptToClipboard,
  downloadScenePrompt,
  type LockedScene 
} from '../../services/scene/SceneLockService';

interface ScenePromptInspectorProps {
  scene: Scene;
  characters: Character[];
  stylePreset?: StylePreset;
  onUpdate: (updates: Partial<Scene>) => void;
  onRegenerate?: () => void;
}

export function ScenePromptInspector({
  scene,
  characters,
  stylePreset,
  onUpdate,
  onRegenerate
}: ScenePromptInspectorProps) {
  const lockedScene = scene as LockedScene;
  const isLocked = lockedScene.locked || false;
  
  // Compose full prompt data
  const composed = composeScenePrompt(scene, characters, {
    stylePreset,
    quality: 'cinematic',
    includeCharacters: true
  });
  
  const handleLock = () => {
    const updated = isLocked ? unlockScene(lockedScene) : lockScene(scene);
    onUpdate(updated);
  };
  
  const handleRegenerate = () => {
    const check = canRegenerateScene(scene);
    if (!check.allowed) {
      alert(check.reason);
      return;
    }
    onRegenerate?.();
  };
  
  const createRenderJob = (type: 'image' | 'video') => {
    const job = {
      id: crypto.randomUUID(),
      scene_id: scene.id,
      type,
      status: 'queued' as const,
      progress: 0,
      prompt: type === 'image' ? composed.imagePrompt : composed.videoPrompt,
      negative_prompt: composed.negativePrompt,
      seed: composed.seed,
      created_at: new Date().toISOString()
    };
    
    console.log(`[RENDER JOB CREATED] ${type.toUpperCase()} for scene:`, scene.title);
    
    // Simulate render progress
    setTimeout(() => {
      console.log(`[RENDER ${type.toUpperCase()}] queued → generating`);
      setTimeout(() => {
        console.log(`[RENDER ${type.toUpperCase()}] generating → completed`);
      }, 2000);
    }, 500);
  };
  
  return (
    <div className="space-y-3 p-4 bg-surface rounded-lg border border-surface-border">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">Prompt Inspector</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={() => copyScenePromptToClipboard(scene, 'visual')}
            className="p-1.5 rounded-md hover:bg-accent-900/20 text-studio-400 hover:text-accent-400 transition-colors"
            title="Copy Visual Prompt"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => downloadScenePrompt(scene, 'txt')}
            className="p-1.5 rounded-md hover:bg-accent-900/20 text-studio-400 hover:text-accent-400 transition-colors"
            title="Export Prompt"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleLock}
            className={`p-1.5 rounded-md transition-colors ${
              isLocked
                ? 'bg-amber-900/20 text-amber-400 hover:bg-amber-900/30'
                : 'hover:bg-accent-900/20 text-studio-400 hover:text-accent-400'
            }`}
            title={isLocked ? 'Unlock Scene' : 'Lock Scene'}
          >
            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>
          {onRegenerate && (
            <button
              onClick={handleRegenerate}
              className="p-1.5 rounded-md hover:bg-accent-900/20 text-studio-400 hover:text-accent-400 transition-colors"
              title="Regenerate Prompt"
              disabled={isLocked}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <PromptField label="Camera" value={composed.cameraPrompt} />
        <PromptField label="Lighting" value={composed.lightingPrompt} />
        <PromptField label="Motion" value={composed.motionPrompt} />
        <PromptField label="Seed" value={composed.seed?.toString() || 'Auto'} />
      </div>
      
      <div className="space-y-2">
        <PromptPreview
          label="Visual Prompt"
          value={scene.prompt_text}
          onCopy={() => navigator.clipboard.writeText(scene.prompt_text)}
          isLocked={isLocked}
          onChange={(val) => onUpdate({ prompt_text: val })}
        />
        <PromptPreview
          label="Negative Prompt"
          value={scene.negative_prompt}
          onCopy={() => navigator.clipboard.writeText(scene.negative_prompt)}
          isNegative
          isLocked={isLocked}
          onChange={(val) => onUpdate({ negative_prompt: val })}
        />
      </div>
      
      <div className="flex gap-2 pt-2">
        <button
          onClick={() => createRenderJob('image')}
          className="btn-secondary flex-1 text-xs flex items-center justify-center gap-1.5"
        >
          <Image className="w-3.5 h-3.5" />
          Generate Image
        </button>
        <button
          onClick={() => createRenderJob('video')}
          className="btn-secondary flex-1 text-xs flex items-center justify-center gap-1.5"
        >
          <Video className="w-3.5 h-3.5" />
          Generate Video
        </button>
      </div>
      
      {isLocked && (
        <div className="p-2 bg-amber-900/20 border border-amber-700/30 rounded-md">
          <p className="text-xs text-amber-400">
            🔒 Scene locked - prompts and seed are protected from changes
          </p>
        </div>
      )}
    </div>
  );
}

function PromptField({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 bg-studio-900/50 rounded">
      <p className="text-[10px] text-studio-500 uppercase mb-0.5">{label}</p>
      <p className="text-xs text-studio-300 truncate">{value}</p>
    </div>
  );
}

function PromptPreview({ 
  label, 
  value, 
  onCopy,
  isNegative,
  isLocked,
  onChange
}: { 
  label: string; 
  value: string;
  onCopy: () => void;
  isNegative?: boolean;
  isLocked?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-studio-500 uppercase">{label}</p>
        <button
          onClick={onCopy}
          className="p-1 rounded hover:bg-accent-900/20 text-studio-500 hover:text-accent-400 transition-colors"
        >
          <Copy className="w-3 h-3" />
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={isLocked}
        className={`w-full p-2 rounded text-xs font-mono leading-relaxed min-h-[60px] max-h-24 resize-y ${
          isNegative ? 'bg-danger-900/10 text-danger-300' : 'bg-studio-900/50 text-studio-300'
        } ${isLocked ? 'cursor-not-allowed opacity-60' : 'focus:ring-1 focus:ring-accent-600/40'} border-0 outline-none`}
      />
    </div>
  );
}
