/**
 * DurationEditor.tsx
 * Inline duration editor for SceneCard.
 * Shows seconds input. Validates 1-300. Saves on blur/enter.
 */
import { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface Props {
  duration: number;
  onSave: (newDuration: number) => void;
}

export function DurationEditor({ duration, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(duration));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(String(duration));
  }, [duration]);

  const handleCommit = () => {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 300) {
      onSave(parsed);
    } else {
      setValue(String(duration)); // reset invalid
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCommit();
    if (e.key === 'Escape') {
      setValue(String(duration));
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="number"
          min={1}
          max={300}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
          className="w-12 text-xs bg-studio-700 border border-accent-500 rounded px-1 py-0.5 text-white text-center focus:outline-none"
          autoFocus
        />
        <span className="text-xs text-studio-400">s</span>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      className="flex items-center gap-1 text-xs text-studio-400 hover:text-white transition-colors group"
      title="Click to edit duration"
    >
      <Clock className="w-3 h-3" />
      <span className="font-mono">{duration}s</span>
    </button>
  );
}
