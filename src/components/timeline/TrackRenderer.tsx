import React from 'react';
import { TimelineTrack, TimelineClip, TimelineAudio, TimelineSubtitle } from '../../services/video/TimelineEngine';

interface TrackRendererProps {
  track: TimelineTrack;
  pxPerSecond: number;
  height: number;
  selectedClipId?: string;
  onClipClick: (clipId: string, e: React.MouseEvent) => void;
  onClipContextMenu: (clipId: string, e: React.MouseEvent) => void;
  readOnly?: boolean;
}

/**
 * Track Renderer Component
 * 
 * Renders a timeline track with its clips
 */
const TrackRenderer: React.FC<TrackRendererProps> = ({
  track,
  pxPerSecond,
  height,
  selectedClipId,
  onClipClick,
  onClipContextMenu,
  readOnly = false
}) => {
  // Get track color based on type
  const getTrackColor = (type: TimelineTrack['type']): string => {
    switch (type) {
      case 'video':
        return 'bg-blue-500';
      case 'audio':
        return 'bg-green-500';
      case 'subtitle':
        return 'bg-yellow-500';
      case 'effects':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };
  
  // Render a clip based on its type
  const renderClip = (element: TimelineClip | TimelineAudio | TimelineSubtitle) => {
    const startPx = element.startTime * pxPerSecond;
    const widthPx = element.duration * pxPerSecond;
    const isSelected = element.id === selectedClipId;
    
    // Common styles for all clip types
    const clipStyles: React.CSSProperties = {
      left: `${startPx}px`,
      width: `${widthPx}px`,
      height: `${height - 6}px`,
      cursor: readOnly ? 'default' : 'pointer',
      position: 'absolute',
      borderRadius: '4px',
      overflow: 'hidden'
    };
    
    // Type-specific styles and content
    if (element.type === 'clip') {
      const clip = element as TimelineClip;
      const clipData = clip.data;
      
      return (
        <div
          key={clip.id}
          style={clipStyles}
          className={`${getTrackColor('video')} ${isSelected ? 'ring-2 ring-white' : ''} 
                     flex flex-col justify-between p-1 relative`}
          onClick={(e) => onClipClick(clip.id, e)}
          onContextMenu={(e) => onClipContextMenu(clip.id, e)}
        >
          <div className="text-xs text-white truncate font-medium">
            {clipData.asset?.display_name || 'Clip'}
          </div>
          <div className="text-xs text-white opacity-75 truncate">
            {clipData.shot?.type || clipData.type} {element.duration.toFixed(1)}s
          </div>
          
          {/* Asset status indicator */}
          {clipData.asset && (
            <div className={`absolute top-0 right-0 w-2 h-2 rounded-full m-1 ${clipData.asset.status === 'complete' ? 'bg-green-500' : clipData.asset.status === 'pending' ? 'bg-yellow-500' : clipData.asset.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'}`} 
                title={`Asset status: ${clipData.asset.status}`} />
          )}
          
          {/* Asset thumbnail if available */}
          {clipData.asset?.thumbnail_url && (
            <div className="absolute left-0 top-0 w-full h-full opacity-20 pointer-events-none">
              <div 
                className="absolute inset-0 bg-center bg-cover" 
                style={{ 
                  backgroundImage: `url(${clipData.asset.thumbnail_url})`,
                  backgroundSize: 'cover', 
                  opacity: 0.2,
                  mixBlendMode: 'overlay' 
                }}
              />
            </div>
          )}
          
          {/* Resize handles */}
          {!readOnly && (
            <>
              <div 
                className="absolute left-0 top-0 w-2 h-full cursor-w-resize opacity-20 hover:opacity-80 bg-white"
                title="Resize start"
              />
              <div 
                className="absolute right-0 top-0 w-2 h-full cursor-e-resize opacity-20 hover:opacity-80 bg-white"
                title="Resize end"
              />
            </>
          )}
          
          {/* Transition indicators */}
          {clip.transitions?.in && (
            <div className="absolute left-0 top-0 h-full w-4 bg-gradient-to-r from-white/50 to-transparent" />
          )}
          {clip.transitions?.out && (
            <div className="absolute right-0 top-0 h-full w-4 bg-gradient-to-l from-white/50 to-transparent" />
          )}
        </div>
      );
    } else if (element.type === 'audio') {
      const audio = element as TimelineAudio;
      const audioData = audio.data;
      
      return (
        <div
          key={audio.id}
          style={clipStyles}
          className={`${getTrackColor('audio')} ${isSelected ? 'ring-2 ring-white' : ''} 
                     flex flex-col justify-between p-1 relative`}
          onClick={(e) => onClipClick(audio.id, e)}
          onContextMenu={(e) => onClipContextMenu(audio.id, e)}
        >
          <div className="text-xs text-white truncate font-medium">
            {audioData.asset?.display_name || `${audioData.type} Audio`}
          </div>
          <div className="text-xs text-white opacity-75 truncate">
            {element.duration.toFixed(1)}s {audioData.volume && `(${(audioData.volume * 100).toFixed(0)}%)`}
          </div>
          
          {/* Asset status indicator */}
          {audioData.asset && (
            <div className={`absolute top-0 right-0 w-2 h-2 rounded-full m-1 ${audioData.asset.status === 'complete' ? 'bg-green-500' : audioData.asset.status === 'pending' ? 'bg-yellow-500' : audioData.asset.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'}`} 
                title={`Asset status: ${audioData.asset.status}`} />
          )}
          
          {/* Render audio waveform visualization (simplified) */}
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden opacity-30">
            <svg width="100%" height="40%" preserveAspectRatio="none">
              <path 
                d="M0,20 Q5,5 10,20 Q15,35 20,20 Q25,5 30,20 Q35,35 40,20 Q45,5 50,20 Q55,35 60,20 Q65,5 70,20 Q75,35 80,20 Q85,5 90,20 Q95,35 100,20"
                stroke="white" 
                strokeWidth="2"
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
          
          {/* Resize handles */}
          {!readOnly && (
            <>
              <div 
                className="absolute left-0 top-0 w-2 h-full cursor-w-resize opacity-20 hover:opacity-80 bg-white"
                title="Resize start"
              />
              <div 
                className="absolute right-0 top-0 w-2 h-full cursor-e-resize opacity-20 hover:opacity-80 bg-white"
                title="Resize end"
              />
            </>
          )}
        </div>
      );
    } else if (element.type === 'subtitle') {
      const subtitle = element as TimelineSubtitle;
      const subtitleData = subtitle.data;
      
      return (
        <div
          key={subtitle.id}
          style={clipStyles}
          className={`${getTrackColor('subtitle')} ${isSelected ? 'ring-2 ring-white' : ''} 
                     flex flex-col justify-center p-1`}
          onClick={(e) => onClipClick(subtitle.id, e)}
          onContextMenu={(e) => onClipContextMenu(subtitle.id, e)}
        >
          <div className="text-xs text-black truncate font-medium">
            {subtitleData.text}
          </div>
          
          {/* Language indicator */}
          {subtitleData.language && (
            <div className="absolute right-1 bottom-1 text-[10px] bg-black/20 px-1 rounded">
              {subtitleData.language}
            </div>
          )}
          
          {/* Resize handles */}
          {!readOnly && (
            <>
              <div 
                className="absolute left-0 top-0 w-2 h-full cursor-w-resize opacity-20 hover:opacity-80 bg-white"
                title="Resize start"
              />
              <div 
                className="absolute right-0 top-0 w-2 h-full cursor-e-resize opacity-20 hover:opacity-80 bg-white"
                title="Resize end"
              />
            </>
          )}
        </div>
      );
    } else {
      // For other element types
      return (
        <div
          key={element.id}
          style={clipStyles}
          className={`bg-gray-500 ${isSelected ? 'ring-2 ring-white' : ''} 
                     flex items-center justify-center p-1`}
          onClick={(e) => onClipClick(element.id, e)}
          onContextMenu={(e) => onClipContextMenu(element.id, e)}
        >
          <div className="text-xs text-white truncate">
            {element.type} ({element.duration.toFixed(1)}s)
          </div>
        </div>
      );
    }
  };
  
  return (
    <div 
      className="relative border-b border-gray-700"
      style={{ height: `${height}px` }}
    >
      {/* Track Background */}
      <div 
        className={`absolute inset-0 ${
          track.type === 'video' ? 'bg-blue-900/10' : 
          track.type === 'audio' ? 'bg-green-900/10' : 
          track.type === 'subtitle' ? 'bg-yellow-900/10' :
          track.type === 'effects' ? 'bg-purple-900/10' :
          'bg-gray-900/10'
        }`}
      />
      
      {/* Time Grid */}
      <div className="absolute inset-0">
        {/* Render grid lines every second */}
        {Array.from({ length: Math.ceil(track.elements.reduce((max, el) => Math.max(max, el.endTime), 0)) }).map((_, i) => (
          <div 
            key={i} 
            className="absolute top-0 h-full border-l border-gray-700 opacity-50"
            style={{ left: `${i * pxPerSecond}px` }}
          />
        ))}
      </div>
      
      {/* Track Elements */}
      {track.elements.map(element => renderClip(element as TimelineClip | TimelineAudio | TimelineSubtitle))}
    </div>
  );
};

export default TrackRenderer;