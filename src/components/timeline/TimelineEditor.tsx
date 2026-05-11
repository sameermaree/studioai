import React, { useState, useEffect, useRef } from 'react';
import { CinematicTimeline, TimelineTrack, TimelineElement, TimelineClip, TimelineAudio, TimelineSubtitle } from '../../services/video/TimelineEngine';
import { VideoClipDefinition } from '../../services/video/VideoSequencer';
import TrackRenderer from './TrackRenderer';
import TimelineControls from './TimelineControls';
import TimeRuler from './TimeRuler';
import TimelinePlayhead from './TimelinePlayhead';
import ClipContextMenu from './ClipContextMenu';

export interface TimelineEditorProps {
  timeline: CinematicTimeline;
  onClipSelect?: (clipId: string) => void;
  onClipMove?: (clipId: string, trackId: string, startTime: number) => void;
  onClipResize?: (clipId: string, duration: number, fromStart: boolean) => void;
  onClipSplit?: (clipId: string, time: number) => void;
  onClipDelete?: (clipId: string) => void;
  onTrackAdd?: (type: TimelineTrack['type'], name?: string) => void;
  onTrackDelete?: (trackId: string) => void;
  onPlaybackChange?: (isPlaying: boolean) => void;
  onSeek?: (time: number) => void;
  selectedClipId?: string;
  currentTime?: number;
  isPlaying?: boolean;
  readOnly?: boolean;
}

/**
 * Timeline Editor Component
 * 
 * A complete timeline editor for video editing with multiple tracks,
 * clip operations, and playback controls.
 */
const TimelineEditor: React.FC<TimelineEditorProps> = ({
  timeline,
  onClipSelect,
  onClipMove,
  onClipResize,
  onClipSplit,
  onClipDelete,
  onTrackAdd,
  onTrackDelete,
  onPlaybackChange,
  onSeek,
  selectedClipId,
  currentTime = 0,
  isPlaying = false,
  readOnly = false
}) => {
  const [zoom, setZoom] = useState(1); // 1 = 100px per second
  const [scrollLeft, setScrollLeft] = useState(0);
  const [trackHeight, setTrackHeight] = useState(80); // height in pixels
  const [isDragging, setIsDragging] = useState(false);
  const [dragData, setDragData] = useState<{
    clipId: string;
    trackId: string;
    startTime: number;
    offsetX: number;
    operation: 'move' | 'resize-start' | 'resize-end';
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    clipId: string;
    x: number;
    y: number;
  } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Calculated values
  const pxPerSecond = 100 * zoom; // Pixels per second
  const timelineWidth = Math.max(timeline.duration * pxPerSecond + 200, timelineRef.current?.clientWidth || 1000);
  const visibleTracks = timeline.tracks.filter(track => !track.collapsed);

  // Track mouse position for dragging
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // Update mouse position during dragging
  useEffect(() => {
    if (!isDragging) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      
      if (dragData) {
        // Convert mouse x position to time
        const timelineRect = timelineRef.current?.getBoundingClientRect();
        if (!timelineRect) return;
        
        const relativeX = e.clientX - timelineRect.left + scrollLeft;
        const time = Math.max(0, relativeX / pxPerSecond);
        
        if (dragData.operation === 'move') {
          // For move operations, we need the time offset from the original drag start
          const timeOffset = time - (dragData.offsetX / pxPerSecond);
          const newStartTime = Math.max(0, dragData.startTime + timeOffset);
          
          // If onClipMove is provided, call it with the new position
          if (onClipMove) {
            onClipMove(dragData.clipId, dragData.trackId, newStartTime);
          }
        } else if (dragData.operation === 'resize-start') {
          // For resize-start operations, we're adjusting the start time and duration
          const clip = findClip(timeline, dragData.clipId);
          if (!clip) return;
          
          const originalEndTime = dragData.startTime + clip.duration;
          const newStartTime = Math.min(time, originalEndTime - 0.1); // Ensure at least 0.1s duration
          const newDuration = originalEndTime - newStartTime;
          
          if (onClipResize) {
            onClipResize(dragData.clipId, newDuration, true);
          }
        } else if (dragData.operation === 'resize-end') {
          // For resize-end operations, we're adjusting only the duration
          const newDuration = Math.max(0.1, time - dragData.startTime);
          
          if (onClipResize) {
            onClipResize(dragData.clipId, newDuration, false);
          }
        }
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      setDragData(null);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragData, pxPerSecond, scrollLeft, timeline, onClipMove, onClipResize]);
  
  // Handle clip selection
  const handleClipClick = (clipId: string, e: React.MouseEvent) => {
    if (readOnly) return;
    
    if (onClipSelect) {
      onClipSelect(clipId);
    }
    
    // Check if click is on the resize handle
    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const isRightEdge = e.clientX > rect.right - 10;
    const isLeftEdge = e.clientX < rect.left + 10;
    
    if (isRightEdge) {
      // Start resize-end operation
      const clip = findClip(timeline, clipId);
      if (!clip || !('trackId' in clip)) return;
      
      setIsDragging(true);
      setDragData({
        clipId,
        trackId: clip.trackId,
        startTime: clip.startTime,
        offsetX: e.clientX - rect.left,
        operation: 'resize-end'
      });
    } else if (isLeftEdge) {
      // Start resize-start operation
      const clip = findClip(timeline, clipId);
      if (!clip || !('trackId' in clip)) return;
      
      setIsDragging(true);
      setDragData({
        clipId,
        trackId: clip.trackId,
        startTime: clip.startTime,
        offsetX: e.clientX - rect.left,
        operation: 'resize-start'
      });
    } else {
      // Start move operation
      const clip = findClip(timeline, clipId);
      if (!clip || !('trackId' in clip)) return;
      
      setIsDragging(true);
      setDragData({
        clipId,
        trackId: clip.trackId,
        startTime: clip.startTime,
        offsetX: e.clientX - rect.left,
        operation: 'move'
      });
    }
  };
  
  // Handle right-click on clip for context menu
  const handleClipContextMenu = (clipId: string, e: React.MouseEvent) => {
    e.preventDefault();
    
    if (readOnly) return;
    
    setContextMenu({
      visible: true,
      clipId,
      x: e.clientX,
      y: e.clientY
    });
  };
  
  // Handle context menu item click
  const handleContextMenuAction = (action: string, clipId: string) => {
    // Handle different context menu actions
    switch (action) {
      case 'split':
        if (onClipSplit) {
          onClipSplit(clipId, currentTime);
        }
        break;
        
      case 'delete':
        if (onClipDelete) {
          onClipDelete(clipId);
        }
        break;
        
      default:
        break;
    }
    
    // Hide the context menu
    setContextMenu(null);
  };
  
  // Handle timeline click for seeking
  const handleTimelineClick = (e: React.MouseEvent) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const relativeX = e.clientX - rect.left + scrollLeft;
    const time = Math.max(0, relativeX / pxPerSecond);
    
    if (onSeek) {
      onSeek(time);
    }
  };
  
  // Handle zoom change
  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
  };
  
  // Handle playback control
  const handlePlayPause = () => {
    if (onPlaybackChange) {
      onPlaybackChange(!isPlaying);
    }
  };
  
  // Handle timeline scroll
  const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft(e.currentTarget.scrollLeft);
  };
  
  // Helper function to find a clip by ID
  const findClip = (timeline: CinematicTimeline, clipId: string): TimelineElement | null => {
    for (const track of timeline.tracks) {
      const clip = track.elements.find(element => element.id === clipId);
      if (clip) {
        return clip;
      }
    }
    return null;
  };
  
  // Handle add track button
  const handleAddTrack = (type: TimelineTrack['type']) => {
    if (onTrackAdd) {
      onTrackAdd(type);
    }
  };
  
  // Handle track delete button
  const handleTrackDelete = (trackId: string) => {
    if (onTrackDelete) {
      onTrackDelete(trackId);
    }
  };
  
  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-200">
      {/* Timeline Controls */}
      <TimelineControls 
        currentTime={currentTime}
        duration={timeline.duration}
        isPlaying={isPlaying}
        zoom={zoom}
        onZoomChange={handleZoomChange}
        onPlayPause={handlePlayPause}
        onSeek={onSeek}
        readOnly={readOnly}
      />
      
      {/* Main Timeline Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Track Labels */}
        <div className="w-48 flex-shrink-0 bg-gray-800 border-r border-gray-700">
          {/* Track Header */}
          <div 
            className="h-8 border-b border-gray-700 flex items-center px-2 text-sm font-medium"
          >
            Tracks
          </div>
          
          {/* Track Labels */}
          <div className="overflow-y-auto" style={{ height: `calc(100% - 2rem)` }}>
            {visibleTracks.map(track => (
              <div 
                key={track.id} 
                className="px-2 flex items-center justify-between border-b border-gray-700 text-sm"
                style={{ height: `${trackHeight}px` }}
              >
                <div className="flex items-center">
                  <div 
                    className={`w-3 h-3 rounded-full mr-2 ${
                      track.type === 'video' ? 'bg-blue-500' : 
                      track.type === 'audio' ? 'bg-green-500' : 
                      'bg-yellow-500'
                    }`}
                  />
                  <span>{track.name}</span>
                </div>
                
                {!readOnly && (
                  <button 
                    className="text-gray-400 hover:text-gray-200 focus:outline-none"
                    onClick={() => handleTrackDelete(track.id)}
                    title="Delete track"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            
            {/* Add Track Buttons */}
            {!readOnly && (
              <div className="p-2 border-b border-gray-700">
                <div className="flex space-x-2">
                  <button
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                    onClick={() => handleAddTrack('video')}
                  >
                    + Video
                  </button>
                  <button
                    className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                    onClick={() => handleAddTrack('audio')}
                  >
                    + Audio
                  </button>
                  <button
                    className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs"
                    onClick={() => handleAddTrack('subtitle')}
                  >
                    + Sub
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Timeline Content */}
        <div className="flex-1 overflow-hidden">
          {/* Time Ruler */}
          <div className="h-8 border-b border-gray-700 sticky top-0 bg-gray-800">
            <TimeRuler 
              duration={timeline.duration} 
              pxPerSecond={pxPerSecond} 
              width={timelineWidth}
            />
          </div>
          
          {/* Tracks and Clips */}
          <div 
            ref={timelineRef}
            className="relative overflow-auto"
            style={{ height: `calc(100% - 2rem)` }}
            onScroll={handleTimelineScroll}
            onClick={handleTimelineClick}
          >
            {/* Render each track */}
            <div style={{ width: `${timelineWidth}px` }}>
              {visibleTracks.map(track => (
                <TrackRenderer
                  key={track.id}
                  track={track}
                  pxPerSecond={pxPerSecond}
                  height={trackHeight}
                  selectedClipId={selectedClipId}
                  onClipClick={handleClipClick}
                  onClipContextMenu={handleClipContextMenu}
                  readOnly={readOnly}
                />
              ))}
            </div>
            
            {/* Playhead */}
            <TimelinePlayhead 
              time={currentTime} 
              pxPerSecond={pxPerSecond} 
              height={visibleTracks.length * trackHeight}
            />
          </div>
        </div>
      </div>
      
      {/* Context Menu */}
      {contextMenu?.visible && (
        <ClipContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          clipId={contextMenu.clipId}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

export default TimelineEditor;