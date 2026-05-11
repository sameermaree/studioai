import React from 'react';

interface TimeRulerProps {
  duration: number;
  pxPerSecond: number;
  width: number;
}

/**
 * Time Ruler Component
 * 
 * Displays time markers on the timeline
 */
const TimeRuler: React.FC<TimeRulerProps> = ({
  duration,
  pxPerSecond,
  width
}) => {
  // Determine the appropriate interval for time markers
  const getTimeInterval = (pxPerSecond: number): number => {
    if (pxPerSecond <= 20) return 10; // Every 10 seconds
    if (pxPerSecond <= 50) return 5;  // Every 5 seconds
    if (pxPerSecond <= 100) return 1; // Every 1 second
    if (pxPerSecond <= 200) return 0.5; // Every 0.5 seconds
    return 0.25; // Every 0.25 seconds
  };
  
  const timeInterval = getTimeInterval(pxPerSecond);
  
  // Format time as MM:SS or MM:SS.ms
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    
    if (timeInterval >= 1) {
      // For larger intervals, show MM:SS
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      // For smaller intervals, show MM:SS.ms
      const milliseconds = Math.floor((timeInSeconds % 1) * 10);
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds}`;
    }
  };
  
  // Generate time markers
  const markers = [];
  const totalMarkers = Math.ceil(duration / timeInterval);
  
  for (let i = 0; i <= totalMarkers; i++) {
    const time = i * timeInterval;
    const position = time * pxPerSecond;
    
    // Skip if position is beyond the width
    if (position > width) continue;
    
    markers.push(
      <div 
        key={i}
        className="absolute h-full flex flex-col items-center"
        style={{ left: `${position}px` }}
      >
        <div className="h-2 w-0.5 bg-gray-400"></div>
        <div className="text-xs text-gray-300">{formatTime(time)}</div>
      </div>
    );
    
    // Add smaller markers between main markers if interval is large enough
    if (timeInterval >= 1 && pxPerSecond >= 50) {
      const smallInterval = timeInterval / 4;
      for (let j = 1; j < 4; j++) {
        const smallTime = time + smallInterval * j;
        if (smallTime > duration) break;
        
        const smallPosition = smallTime * pxPerSecond;
        markers.push(
          <div 
            key={`${i}-${j}`}
            className="absolute h-1 w-0.5 bg-gray-600"
            style={{ left: `${smallPosition}px` }}
          ></div>
        );
      }
    }
  }
  
  return (
    <div 
      className="relative h-full"
      style={{ width: `${width}px` }}
    >
      {markers}
    </div>
  );
};

export default TimeRuler;