import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import TimelineEditor from '../components/timeline/TimelineEditor';
import { TimelineEngine, CinematicTimeline, TimelineTrack } from '../services/video/TimelineEngine';
import { VideoSequencer } from '../services/video/VideoSequencer';
import { FFmpegService } from '../services/video/FFmpegService';
import { getSampleTimeline, createSampleTimeline } from '../data/sampleTimeline';

/**
 * Timeline Editor Page
 * 
 * Main page for editing video timelines
 */
const TimelineEditorPage: React.FC = () => {
  const { timelineId } = useParams<{ timelineId: string }>();
  const navigate = useNavigate();
  const [timeline, setTimeline] = useState<CinematicTimeline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | undefined>();
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [renderProgress, setRenderProgress] = useState<number | null>(null);
  const [timelineEngine] = useState(() => new TimelineEngine());
  const [videoSequencer] = useState(() => new VideoSequencer());
  const [ffmpegService] = useState(() => new FFmpegService());
  
  // Load the timeline
  useEffect(() => {
    const loadTimeline = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        if (!timelineId) {
          throw new Error('No timeline ID provided');
        }
        
        // For demo purposes - if timelineId is 'new', create a new timeline
        if (timelineId === 'new') {
          const newTimelineId = `timeline-${Date.now()}`;
          const sampleTimeline = createSampleTimeline(newTimelineId);
          
          // Store the timeline in the engine
          timelineEngine.timelines.set(newTimelineId, sampleTimeline);
          
          // Redirect to the new timeline ID
          navigate(`/timeline/${newTimelineId}`, { replace: true });
          return;
        }
        
        // Get the timeline from the engine
        let loadedTimeline = timelineEngine.getTimeline(timelineId);
        
        if (!loadedTimeline) {
          // First, check if we have a sequence that we can use to create a timeline
          const sequence = videoSequencer.getSequence(timelineId);
          
          if (sequence) {
            // Create a timeline from the sequence
            const newTimeline = timelineEngine.createTimeline(
              sequence.name,
              sequence.id,
              {
                frameRate: sequence.fps,
                width: sequence.width,
                height: sequence.height
              }
            );
            
            setTimeline(newTimeline);
            return;
          } 
          
          // If no sequence, create a sample timeline for demo purposes
          console.log('No sequence found, creating sample timeline for:', timelineId);
          loadedTimeline = createSampleTimeline(timelineId);
          timelineEngine.timelines.set(timelineId, loadedTimeline);
        }
        
        // Use the timeline
        setTimeline(loadedTimeline);
      } catch (error) {
        console.error('Error loading timeline:', error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTimeline();
  }, [timelineId, timelineEngine, videoSequencer, navigate]);
  
  // Update window title with timeline name
  useEffect(() => {
    if (timeline) {
      document.title = `${timeline.name} - Timeline Editor`;
      return () => {
        document.title = 'SERI AI STUDIO';
      };
    }
  }, [timeline]);
  
  // Playback simulation
  useEffect(() => {
    if (!isPlaying || !timeline) return;
    
    const fps = timeline.settings.frameRate;
    const frameTime = 1000 / fps;
    
    const interval = setInterval(() => {
      setCurrentTime(prevTime => {
        // Check if we've reached the end of the timeline
        if (prevTime >= timeline.duration) {
          setIsPlaying(false);
          return prevTime;
        }
        
        // Increment by one frame
        return prevTime + (frameTime / 1000);
      });
    }, frameTime);
    
    return () => clearInterval(interval);
  }, [isPlaying, timeline]);
  
  // Handle clip selection
  const handleClipSelect = useCallback((clipId: string) => {
    setSelectedClipId(clipId);
  }, []);
  
  // Handle clip move
  const handleClipMove = useCallback((clipId: string, trackId: string, startTime: number) => {
    if (!timeline) return;
    
    const updatedTimeline = timelineEngine.moveElement(
      timeline.id,
      clipId,
      startTime,
      trackId
    );
    
    if (updatedTimeline) {
      setTimeline(timelineEngine.getTimeline(timeline.id)!);
    }
  }, [timeline, timelineEngine]);
  
  // Handle clip resize
  const handleClipResize = useCallback((clipId: string, duration: number, fromStart: boolean) => {
    if (!timeline) return;
    
    const updatedTimeline = timelineEngine.resizeElement(
      timeline.id,
      clipId,
      duration,
      fromStart
    );
    
    if (updatedTimeline) {
      setTimeline(timelineEngine.getTimeline(timeline.id)!);
    }
  }, [timeline, timelineEngine]);
  
  // Handle clip split
  const handleClipSplit = useCallback((clipId: string, time: number) => {
    if (!timeline) return;
    
    const result = timelineEngine.splitElement(
      timeline.id,
      clipId,
      time
    );
    
    if (result) {
      setTimeline(timelineEngine.getTimeline(timeline.id)!);
    }
  }, [timeline, timelineEngine]);
  
  // Handle clip delete
  const handleClipDelete = useCallback((clipId: string) => {
    if (!timeline) return;
    
    const success = timelineEngine.deleteElement(
      timeline.id,
      clipId
    );
    
    if (success) {
      setTimeline(timelineEngine.getTimeline(timeline.id)!);
      if (selectedClipId === clipId) {
        setSelectedClipId(undefined);
      }
    }
  }, [timeline, timelineEngine, selectedClipId]);
  
  // Handle track add
  const handleTrackAdd = useCallback((type: TimelineTrack['type'], name?: string) => {
    if (!timeline) return;
    
    const track = timelineEngine.addTrack(
      timeline.id,
      type,
      name
    );
    
    if (track) {
      setTimeline(timelineEngine.getTimeline(timeline.id)!);
    }
  }, [timeline, timelineEngine]);
  
  // Handle track delete
  const handleTrackDelete = useCallback((trackId: string) => {
    if (!timeline) return;
    
    // In a real implementation, this would remove the track and handle
    // any elements on the track appropriately
    // For now, we'll just show an alert
    alert(`Delete track ${trackId} is not implemented yet`);
  }, [timeline]);
  
  // Handle playback control
  const handlePlaybackChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);
  
  // Handle seek
  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);
  
  // Handle render
  const handleRender = useCallback(async () => {
    if (!timeline) return;
    
    setRenderProgress(0);
    
    try {
      // In a real implementation, this would call FFmpeg to render the timeline
      // For now, we'll just simulate progress
      for (let i = 1; i <= 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        setRenderProgress(i * 10);
      }
      
      // After "rendering" is complete
      alert('Render complete! (This is a simulation)');
      setRenderProgress(null);
    } catch (error) {
      console.error('Error rendering timeline:', error);
      setRenderProgress(null);
      setError(error instanceof Error ? error.message : 'An error occurred during rendering');
    }
  }, [timeline]);
  
  // Handle export timeline
  const handleExportTimeline = useCallback(() => {
    if (!timeline) return;
    
    try {
      // Export the timeline to JSON
      const timelineJson = timelineEngine.exportTimeline(timeline.id);
      
      // Create a download link
      const blob = new Blob([timelineJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create a temporary anchor element and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `${timeline.name.replace(/\s+/g, '_')}_timeline.json`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting timeline:', error);
      setError(error instanceof Error ? error.message : 'An error occurred during export');
    }
  }, [timeline, timelineEngine]);
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading timeline...</p>
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-center max-w-md">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 text-red-500 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h2 className="text-xl text-red-400 font-bold mb-2">Error Loading Timeline</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <div className="flex justify-center space-x-4">
            <Link 
              to="/rendering" 
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded focus:outline-none"
            >
              Return to Rendering
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded focus:outline-none"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Render if no timeline
  if (!timeline) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-center max-w-md">
          <h2 className="text-xl text-white font-bold mb-2">No Timeline Found</h2>
          <p className="text-gray-300 mb-4">The requested timeline could not be found.</p>
          <Link 
            to="/rendering" 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded focus:outline-none"
          >
            Return to Rendering
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 p-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center">
          <Link 
            to="/rendering" 
            className="text-gray-400 hover:text-white mr-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className="text-white text-lg font-medium">
            {timeline.name}
          </h1>
          {timeline.duration > 0 && (
            <span className="text-gray-400 text-sm ml-2">
              ({Math.floor(timeline.duration / 60)}:{Math.floor(timeline.duration % 60).toString().padStart(2, '0')})
            </span>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {/* Timeline Info */}
          <div className="text-gray-400 text-sm">
            {timeline.settings.width}×{timeline.settings.height} · {timeline.settings.frameRate} fps
          </div>
          
          {/* Render Button */}
          <button
            className="px-4 py-1 bg-green-600 hover:bg-green-700 text-white rounded flex items-center"
            onClick={handleRender}
            disabled={renderProgress !== null}
          >
            {renderProgress !== null ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Rendering {renderProgress}%
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                Render
              </>
            )}
          </button>
          
          {/* Export Button */}
          <button
            onClick={handleExportTimeline}
            className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Export
          </button>
        </div>
      </div>
      
      {/* Timeline Editor */}
      <div className="flex-1 overflow-hidden">
        <TimelineEditor
          timeline={timeline}
          onClipSelect={handleClipSelect}
          onClipMove={handleClipMove}
          onClipResize={handleClipResize}
          onClipSplit={handleClipSplit}
          onClipDelete={handleClipDelete}
          onTrackAdd={handleTrackAdd}
          onTrackDelete={handleTrackDelete}
          onPlaybackChange={handlePlaybackChange}
          onSeek={handleSeek}
          selectedClipId={selectedClipId}
          currentTime={currentTime}
          isPlaying={isPlaying}
        />
      </div>
    </div>
  );
};

export default TimelineEditorPage;