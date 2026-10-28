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

  // Local scrub state: tracks slider position during drag without firing
  // expensive telemetry recalculation on every tick. Only commits on release.
  const [scrubDays, setScrubDays] = useState<number | null>(null);
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

  // Use local scrub value while dragging, committed value otherwise
  const displayDays = scrubDays ?? diffDays;
  const displayDate = scrubDays !== null
    ? new Date(now.getTime() + scrubDays * 24 * 3600 * 1000)
    : currentDate;

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const daysOffset = parseFloat(e.target.value);
    setScrubDays(daysOffset); // Local only — no parent callback yet
  }, []);

  const commitScrub = useCallback(() => {
    if (!isScrubbingRef.current) return;
    isScrubbingRef.current = false;
    if (scrubDays !== null) {
      const freshNow = new Date(); // Use current time, not stale render-time `now`
      const newDate = new Date(freshNow.getTime() + scrubDays * 24 * 3600 * 1000);
      onChangeDate(newDate);
      setScrubDays(null);
    }
  }, [scrubDays, onChangeDate]);

  const handleSliderMouseDown = () => { isScrubbingRef.current = true; };
  const handleSliderMouseUp = () => { commitScrub(); };
  const handleSliderTouchEnd = () => { commitScrub(); };

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-3 px-4 shadow-2xl flex flex-wrap items-center justify-between gap-4 text-xs text-slate-200">
      {/* Time Mode and Play/Pause */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (isLive) onToggleLive();
            setIsPlaying(!isPlaying);
          }}
          className={`p-2 rounded-xl border transition-all ${
            isPlaying
              ? 'bg-amber-600/30 text-amber-300 border-amber-500/60'
              : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all font-mono font-semibold ${
            isLive
              ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/60 shadow-md shadow-cyan-950'
              : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-700'
          }`}
          title="Sync with real-time current UTC"
        >
          <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-cyan-400 animate-ping' : 'bg-slate-500'}`} />
          <span>LIVE NOW</span>
        </button>

        <button
          onClick={() => {
            setIsPlaying(false);
            onChangeDate(new Date());
          }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          title="Reset to current moment"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Date & UTC Readout */}
      <div className="flex items-center gap-3 font-mono bg-slate-950/70 px-3 py-1.5 rounded-xl border border-slate-800/80 text-[11px]">
        <div className="flex items-center gap-1.5 text-cyan-400">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>UTC: {displayDate.toISOString().replace('T', ' ').slice(0, 19)}Z</span>
        </div>
        <div className="text-slate-500 hidden sm:block">|</div>
        <div className="text-slate-400 hidden sm:flex items-center gap-1">
          <Moon className="w-3.5 h-3.5 text-amber-400" />
          <span>Offset: {displayDays > 0 ? `+${displayDays.toFixed(1)}` : displayDays.toFixed(1)} d</span>
        </div>
      </div>

      {/* Synodic Month Timeline Slider */}
      <div className="flex items-center gap-3" style={{ width: '320px' }}>
        <span className="text-[10px] font-mono text-slate-400 shrink-0">-15d</span>
        <input
          type="range"
          min="-15"
          max="15"
          step="0.25"
          value={displayDays}
          onChange={handleSliderChange}
          onMouseDown={handleSliderMouseDown}
          onMouseUp={handleSliderMouseUp}
          onTouchStart={handleSliderMouseDown}
          onTouchEnd={handleSliderTouchEnd}
          className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
        />
        <span className="text-[10px] font-mono text-slate-400 shrink-0">+15d</span>
      </div>
    </div>
  );
};
