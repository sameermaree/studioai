import React from 'react';

interface TimelinePlayheadProps {
  time: number;
  pxPerSecond: number;
  height: number;
}

/**
 * Timeline Playhead Component
 * 
 * Displays the current playback position in the timeline
 */
const TimelinePlayhead: React.FC<TimelinePlayheadProps> = ({
  time,
  pxPerSecond,
  height
}) => {
  const position = time * pxPerSecond;
  
  return (
    <div 
      className="absolute top-0 h-full pointer-events-none z-10"
      style={{ left: `${position}px` }}
    >
      {/* Playhead triangle */}
      <div className="w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-red-500 mx-auto" />
      
      {/* Playhead line */}
      <div 
        className="w-0.5 bg-red-500 mx-auto"
        style={{ height: `${height}px` }}
      />
    </div>
  );
};

export default TimelinePlayhead;