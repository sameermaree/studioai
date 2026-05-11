import React from 'react';

interface TimelineControlsProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onPlayPause: () => void;
  onSeek?: (time: number) => void;
  readOnly?: boolean;
}

/**
 * Timeline Controls Component
 * 
 * Displays playback controls and timecode information for the timeline
 */
const TimelineControls: React.FC<TimelineControlsProps> = ({
  currentTime,
  duration,
  isPlaying,
  zoom,
  onZoomChange,
  onPlayPause,
  onSeek,
  readOnly = false
}) => {
  // Format time as HH:MM:SS.mmm
  const formatTime = (timeInSeconds: number): string => {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const milliseconds = Math.floor((timeInSeconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${
      minutes.toString().padStart(2, '0')}:${
      seconds.toString().padStart(2, '0')}.${
      milliseconds.toString().padStart(3, '0')}`;
  };
  
  // Handle zoom slider change
  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(e.target.value);
    onZoomChange(newZoom);
  };
  
  // Handle timeline slider change
  const handleTimelineSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSeek) {
      const newTime = parseFloat(e.target.value);
      onSeek(newTime);
    }
  };
  
  // Handle seek to start
  const handleSeekStart = () => {
    if (onSeek) {
      onSeek(0);
    }
  };
  
  // Handle seek to end
  const handleSeekEnd = () => {
    if (onSeek) {
      onSeek(duration);
    }
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700 p-2 flex items-center space-x-4">
      {/* Timecode Display */}
      <div className="bg-black px-3 py-1 rounded font-mono text-sm">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
      
      {/* Playback Controls */}
      <div className="flex items-center space-x-2">
        <button
          className="p-1 rounded hover:bg-gray-700 focus:outline-none"
          onClick={handleSeekStart}
          disabled={readOnly}
          title="Go to Start"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
        
        <button
          className="p-1 rounded hover:bg-gray-700 focus:outline-none"
          onClick={onPlayPause}
          disabled={readOnly}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          )}
        </button>
        
        <button
          className="p-1 rounded hover:bg-gray-700 focus:outline-none"
          onClick={handleSeekEnd}
          disabled={readOnly}
          title="Go to End"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 15.707a1 1 0 001.414 0l5-5a1 1 0 000-1.414l-5-5a1 1 0 00-1.414 1.414L8.586 10 4.293 14.293a1 1 0 000 1.414zm6 0a1 1 0 001.414 0l5-5a1 1 0 000-1.414l-5-5a1 1 0 00-1.414 1.414L14.586 10l-4.293 4.293a1 1 0 000 1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      
      {/* Timeline Slider */}
      <div className="flex-1">
        <input
          type="range"
          min="0"
          max={duration}
          step="0.01"
          value={currentTime}
          onChange={handleTimelineSliderChange}
          disabled={readOnly}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
        />
      </div>
      
      {/* Zoom Control */}
      <div className="flex items-center space-x-2">
        <span className="text-xs">Zoom:</span>
        <input
          type="range"
          min="0.1"
          max="5"
          step="0.1"
          value={zoom}
          onChange={handleZoomChange}
          className="w-24 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );
};

export default TimelineControls;