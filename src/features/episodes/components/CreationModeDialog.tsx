/**
 * CreationModeDialog.tsx
 * Simple modal: choose Auto (AI) or Manual episode creation.
 */
import { X, Wand2, PenLine } from 'lucide-react';

interface Props {
  onAuto: () => void;
  onManual: () => void;
  onClose: () => void;
}

export function CreationModeDialog({ onAuto, onManual, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">New Episode</h2>
          <button onClick={onClose}
            className="p-1 text-studio-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-studio-400 mb-5">
          How would you like to create this episode?
        </p>

        <div className="flex flex-col gap-3">
          {/* Auto */}
          <button
            onClick={onAuto}
            className="flex items-start gap-4 p-4 rounded-xl border border-accent-700/30
              bg-accent-600/10 hover:bg-accent-600/15 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-accent-600/20 flex items-center
              justify-center shrink-0 group-hover:bg-accent-600/30 transition-colors">
              <Wand2 className="w-5 h-5 text-accent-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Auto Episode</p>
              <p className="text-xs text-studio-400 mt-0.5 leading-relaxed">
                AI generates story, characters, and scenes automatically from your idea.
              </p>
            </div>
          </button>

          {/* Manual */}
          <button
            onClick={onManual}
            className="flex items-start gap-4 p-4 rounded-xl border border-studio-700
              bg-studio-900 hover:bg-studio-800 hover:border-studio-500 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-studio-800 flex items-center
              justify-center shrink-0 group-hover:bg-studio-700 transition-colors">
              <PenLine className="w-5 h-5 text-studio-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Manual Episode</p>
              <p className="text-xs text-studio-400 mt-0.5 leading-relaxed">
                Full control. Create title, characters, and scenes yourself. No AI required.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
