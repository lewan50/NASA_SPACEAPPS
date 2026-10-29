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
      case 'Landed': return 'text-emerald-400';
      case 'Upcoming': return 'text-blue-400';
      case 'Anomaly': return 'text-orange-400';
      case 'Cancelled': return 'text-slate-400';
      default: return 'text-slate-300';
    }
  };

  return (
    <div className="w-[280px] lg:w-[280px] md:w-[240px] shrink-0 h-full bg-slate-950/60 backdrop-blur-xl border-r border-white/5 flex flex-col z-20 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-2 mb-3">
          <Rocket className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-300">Select Mission</span>
        </div>

        {/* Mission Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-900/50 border border-white/10 rounded-lg text-sm text-slate-200 hover:bg-slate-900/80 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {selectedMission ? (
                <>
                  <span className="font-medium truncate">{selectedMission.lander_name}</span>
                  <span className={`text-[10px] font-medium shrink-0 ${getStatusColor(selectedMission.status)}`}>
                    {selectedMission.status}
                  </span>
                </>
              ) : (
                <span className="text-slate-500">Choose a mission...</span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-white/10 rounded-lg shadow-lg max-h-[60vh] overflow-y-auto z-50">
              {/* Status Filter */}
              <div className="p-3 border-b border-white/5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['ALL', 'Landed', 'Upcoming', 'Anomaly', 'Cancelled'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`text-[11px] px-2.5 py-1 rounded-md transition-all ${
                        filterStatus === status
                          ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {status === 'ALL' ? 'All' : status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mission List */}
              <div className="p-2 space-y-1">
                {filteredMissions.map((m) => {
                  const isSelected = selectedMission?.mission_id === m.mission_id;
                  return (
                    <button
                      key={m.mission_id}
                      onClick={() => {
                        onSelectMission(m);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                        isSelected
                          ? 'bg-cyan-500/10 border border-cyan-500/30'
                          : 'hover:bg-slate-800/50 border border-transparent'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-500">{m.task_order}</span>
                          <span className={`text-[10px] font-medium ${getStatusColor(m.status)}`}>
                            {m.status}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-slate-100 truncate mt-0.5">{m.lander_name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{m.vendor} • {m.target_region}</div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                    </button>
                  );
                })}
                {filteredMissions.length === 0 && (
                  <div className="text-center py-6 text-xs text-slate-500">No missions match filter</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selected Mission Quick Info */}
      {selectedMission && (
        <div className="p-4 space-y-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <MapPin className="w-4 h-4 text-slate-500" />
            <span className="font-medium">Landing Site</span>
          </div>
          <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5">
            <div className="font-medium text-slate-200">{selectedMission.target_region}</div>
            <div className="font-mono text-slate-400 text-[11px] mt-1.5">
              {Math.abs(selectedMission.coordinates.latitude).toFixed(2)}° {selectedMission.coordinates.latitude >= 0 ? 'N' : 'S'},{' '}
              {Math.abs(selectedMission.coordinates.longitude).toFixed(2)}° {selectedMission.coordinates.longitude >= 0 ? 'E' : 'W'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1.5">
              {selectedMission.payload_array.length} payloads • {selectedMission.coordinates.designation}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
