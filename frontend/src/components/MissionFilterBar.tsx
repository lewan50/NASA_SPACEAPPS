import React, { useState, useRef, useEffect } from 'react';
import type { CLPSMission } from '../types/mission';
import { ChevronDown, Rocket, MapPin, Check } from 'lucide-react';

interface MissionFilterBarProps {
  missions: CLPSMission[];
  selectedMission: CLPSMission | null;
  onSelectMission: (mission: CLPSMission) => void;
}

export const MissionFilterBar: React.FC<MissionFilterBarProps> = ({
  missions,
  selectedMission,
  onSelectMission,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'Landed' | 'Upcoming' | 'Anomaly' | 'Cancelled'>('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter missions
  const filteredMissions = missions.filter((m) => {
    if (filterStatus === 'ALL') return true;
    return m.status === filterStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Landed': return 'text-emerald-300 bg-emerald-950/60 border-emerald-800';
      case 'Upcoming': return 'text-blue-300 bg-blue-950/60 border-blue-800';
      case 'Anomaly': return 'text-orange-300 bg-orange-950/60 border-orange-800';
      case 'Cancelled': return 'text-slate-400 bg-slate-950/60 border-slate-700';
      default: return 'text-slate-300 bg-slate-800/60 border-slate-700';
    }
  };

  return (
    <div className="w-[280px] lg:w-[280px] md:w-[240px] shrink-0 h-full bg-slate-900/90 backdrop-blur-xl border-r border-slate-800 flex flex-col shadow-2xl z-20 overflow-hidden text-slate-200">
      {/* Header */}
      <div className="p-3 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center gap-2 mb-2">
          <Rocket className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-white">Select Mission</span>
        </div>

        {/* Mission Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 hover:border-cyan-500/50 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {selectedMission ? (
                <>
                  <span className="font-semibold truncate">{selectedMission.lander_name}</span>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${getStatusColor(selectedMission.status)}`}>
                    {selectedMission.status}
                  </span>
                </>
              ) : (
                <span className="text-slate-500">Choose a mission...</span>
              )}
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-h-[60vh] overflow-y-auto z-50">
              {/* Status Filter */}
              <div className="p-2 border-b border-slate-800">
                <div className="flex items-center gap-1 flex-wrap">
                  {(['ALL', 'Landed', 'Upcoming', 'Anomaly', 'Cancelled'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`text-[10px] px-2 py-1 rounded transition-all ${
                        filterStatus === status
                          ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/60 font-semibold'
                          : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 border border-transparent'
                      }`}
                    >
                      {status === 'ALL' ? 'All' : status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mission List */}
              <div className="p-1.5 space-y-0.5">
                {filteredMissions.map((m) => {
                  const isSelected = selectedMission?.mission_id === m.mission_id;
                  return (
                    <button
                      key={m.mission_id}
                      onClick={() => {
                        onSelectMission(m);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded text-left transition-all ${
                        isSelected
                          ? 'bg-cyan-950/60 border border-cyan-500/50'
                          : 'hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-cyan-400 font-semibold">{m.task_order}</span>
                          <span className={`text-[8px] font-mono px-1 py-0.5 rounded border ${getStatusColor(m.status)}`}>
                            {m.status}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-100 truncate mt-0.5">{m.lander_name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{m.vendor} • {m.target_region}</div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                    </button>
                  );
                })}
                {filteredMissions.length === 0 && (
                  <div className="text-center py-4 text-[10px] text-slate-500">No missions match filter</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selected Mission Quick Info */}
      {selectedMission && (
        <div className="p-3 space-y-2 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-400">
            <MapPin className="w-3 h-3 text-cyan-400" />
            <span className="font-medium">Landing Site:</span>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
            <div className="font-semibold text-slate-200">{selectedMission.target_region}</div>
            <div className="font-mono text-cyan-300 text-[10px] mt-1">
              {Math.abs(selectedMission.coordinates.latitude).toFixed(2)}° {selectedMission.coordinates.latitude >= 0 ? 'N' : 'S'},{' '}
              {Math.abs(selectedMission.coordinates.longitude).toFixed(2)}° {selectedMission.coordinates.longitude >= 0 ? 'E' : 'W'}
            </div>
            <div className="text-[9px] text-slate-400 mt-1">
              {selectedMission.payload_array.length} payloads • {selectedMission.coordinates.designation}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
