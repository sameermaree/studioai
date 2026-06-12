/**
 * SceneDetailPanel.tsx — slide-in panel showing selected scene details (readonly Phase 1).
 */
import { X, Camera, Users, FileText } from 'lucide-react';
import { useTimelineStore } from '../../store/useTimelineStore';
import { useTimelineScenes } from '../../hooks/useTimelineScenes';
import { buildComfyUrl } from '../../lib/buildMediaUrl';

export function SceneDetailPanel() {
  const { selectedSceneId, selectScene } = useTimelineStore();
  const { orderedScenes } = useTimelineScenes();

  const selected = orderedScenes.find((ts) => ts.scene.id === selectedSceneId);
  if (!selected) return null;

  const { scene } = selected;
  const thumbnailUrl = buildComfyUrl(scene.render_url);

  return (
    <div className="w-64 shrink-0 border-l border-studio-700 bg-studio-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-studio-700">
        <span className="text-xs font-medium text-studio-300">Scene Details</span>
        <button
          onClick={() => selectScene(null)}
          className="p-0.5 text-studio-500 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Thumbnail */}
      {thumbnailUrl && (
        <div className="w-full aspect-video bg-studio-800 shrink-0">
          <img src={thumbnailUrl} alt={scene.title} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Info */}
      <div className="flex flex-col gap-3 p-3 overflow-y-auto">
        <div>
          <p className="text-xs text-studio-500 mb-0.5">Title</p>
          <p className="text-sm font-medium text-white">{scene.title}</p>
        </div>

        {scene.camera_angle && (
          <div className="flex items-start gap-2">
            <Camera className="w-3.5 h-3.5 text-studio-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-studio-500">Camera</p>
              <p className="text-xs text-white">{scene.camera_angle}</p>
            </div>
          </div>
        )}

        {scene.narration && (
          <div className="flex items-start gap-2">
            <FileText className="w-3.5 h-3.5 text-studio-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-studio-500 mb-0.5">Narration</p>
              <p className="text-xs text-studio-300 leading-relaxed line-clamp-4">
                {scene.narration}
              </p>
            </div>
          </div>
        )}

        {scene.characters.length > 0 && (
          <div className="flex items-start gap-2">
            <Users className="w-3.5 h-3.5 text-studio-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-studio-500">Characters</p>
              <p className="text-xs text-white">{scene.characters.length} assigned</p>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-studio-800">
          <p className="text-xs text-studio-500 text-center">
            Edit scenes in the Episodes page
          </p>
        </div>
      </div>
    </div>
  );
}
