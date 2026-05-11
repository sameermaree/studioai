import React, { useEffect, useRef } from 'react';

interface ClipContextMenuProps {
  x: number;
  y: number;
  clipId: string;
  onAction: (action: string, clipId: string) => void;
  onClose: () => void;
}

/**
 * Context Menu for Timeline Clips
 * 
 * Displays a context menu with options for clip operations
 */
const ClipContextMenu: React.FC<ClipContextMenuProps> = ({
  x,
  y,
  clipId,
  onAction,
  onClose
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Handle click outside the menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);
  
  // Handle action click
  const handleActionClick = (action: string) => {
    onAction(action, clipId);
    onClose();
  };
  
  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-800 shadow-lg rounded border border-gray-700"
      style={{ 
        left: `${x}px`, 
        top: `${y}px`,
        minWidth: '150px'
      }}
    >
      <div className="py-1">
        <button
          className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 focus:outline-none"
          onClick={() => handleActionClick('split')}
        >
          Split at Playhead
        </button>
        <button
          className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 focus:outline-none"
          onClick={() => handleActionClick('copy')}
        >
          Copy
        </button>
        <button
          className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 focus:outline-none"
          onClick={() => handleActionClick('duplicate')}
        >
          Duplicate
        </button>
        <div className="border-t border-gray-700 my-1"></div>
        <button
          className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 focus:outline-none"
          onClick={() => handleActionClick('delete')}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default ClipContextMenu;