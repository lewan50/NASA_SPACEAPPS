import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Clock, Moon } from 'lucide-react';

interface TimelineControlProps {
  currentDate: Date;
  onChangeDate: (date: Date) => void;
  isLive: boolean;
  onToggleLive: () => void;
}

export const TimelineControl: React.FC<TimelineControlProps> = ({
  currentDate,
  onChangeDate,
  isLive,
  onToggleLive,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const speedMultiplier = 12; // hours per tick (constant)

  // Track active drag to pause playback during scrub
  const isScrubbingRef = useRef(false);

  // Playback timer loop: increments time by speedMultiplier hours every 600ms.
  // Pauses updates while user is actively scrubbing to prevent slider jumps.
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (isScrubbingRef.current) return; // Don't fight the user's drag
      onChangeDate(new Date(currentDate.getTime() + speedMultiplier * 3600 * 1000));
    }, 600);
    return () => clearInterval(interval);
  }, [isPlaying, currentDate, onChangeDate, speedMultiplier]);

  // Handle manual range scrub (range: -15 to +15 days relative to now)
  const now = new Date();
  const diffDays = (currentDate.getTime() - now.getTime()) / (1000 * 3600 * 24);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const daysOffset = parseFloat(e.target.value);
    const freshNow = new Date();
    const newDate = new Date(freshNow.getTime() + daysOffset * 24 * 3600 * 1000);
    onChangeDate(newDate); // Immediate update for smooth transitions
  }, [onChangeDate]);

  const handleSliderMouseDown = () => { isScrubbingRef.current = true; };
  const handleSliderMouseUp = () => { isScrubbingRef.current = false; };
  const handleSliderTouchEnd = () => { isScrubbingRef.current = false; };

  return (
    <div className="bg-slate-950/80 backdrop-blur-xl border border-white/5 rounded-xl p-3 px-4 shadow-sm flex flex-wrap items-center justify-between gap-4 text-sm">
      {/* Time Mode and Play/Pause */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (isLive) onToggleLive();
            setIsPlaying(!isPlaying);
          }}
          className={`p-2 rounded-lg transition-all ${
            isPlaying
              ? 'bg-amber-500/20 text-amber-300'
              : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800'
          }`}
          title={isPlaying ? 'Pause orbital timeline' : 'Play time-lapse (advance terminator)'}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <button
          onClick={() => {
            setIsPlaying(false);
            onToggleLive();
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all font-medium ${
            isLive
              ? 'bg-cyan-500/20 text-cyan-300'
              : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
          }`}
          title="Sync with real-time current UTC"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
          <span>Live</span>
        </button>

        <button
          onClick={() => {
            setIsPlaying(false);
            onChangeDate(new Date());
          }}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
          title="Reset to current moment"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Date & UTC Readout */}
      <div className="flex items-center gap-3 font-mono text-xs">
        <div className="flex items-center gap-1.5 text-slate-300">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>{currentDate.toISOString().replace('T', ' ').slice(0, 19)}Z</span>
        </div>
        <div className="text-slate-600 hidden sm:block">|</div>
        <div className="text-slate-400 hidden sm:flex items-center gap-1">
          <Moon className="w-3.5 h-3.5 text-slate-600" />
          <span>{diffDays > 0 ? `+${diffDays.toFixed(1)}` : diffDays.toFixed(1)} d</span>
        </div>
      </div>

      {/* Synodic Month Timeline Slider */}
      <div className="flex items-center gap-3" style={{ width: '320px' }}>
        <span className="text-[11px] font-mono text-slate-500 shrink-0">-15d</span>
        <input
          type="range"
          min="-15"
          max="15"
          step="0.25"
          value={diffDays}
          onChange={handleSliderChange}
          onMouseDown={handleSliderMouseDown}
          onMouseUp={handleSliderMouseUp}
          onTouchStart={handleSliderMouseDown}
          onTouchEnd={handleSliderTouchEnd}
          className="flex-1 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer accent-cyan-500"
        />
        <span className="text-[11px] font-mono text-slate-500 shrink-0">+15d</span>
      </div>
    </div>
  );
};
