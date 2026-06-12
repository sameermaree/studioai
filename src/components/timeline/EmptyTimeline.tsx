/**
 * EmptyTimeline.tsx — shown when episode has no scenes or doesn't exist.
 */
import { Film } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  reason: 'no-episode' | 'no-scenes';
}

export function EmptyTimeline({ reason }: Props) {
  const navigate = useNavigate();
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-studio-800 flex items-center justify-center">
        <Film className="w-8 h-8 text-studio-500" />
      </div>
      <div>
        <p className="text-white font-medium">
          {reason === 'no-episode' ? 'Episode not found' : 'No scenes yet'}
        </p>
        <p className="text-sm text-studio-400 mt-1">
          {reason === 'no-episode'
            ? 'This episode does not exist.'
            : 'Add scenes to your episode first, then return to Timeline.'}
        </p>
      </div>
      <button onClick={() => navigate('/episodes')} className="btn-secondary text-sm">
        Go to Episodes
      </button>
    </div>
  );
}
