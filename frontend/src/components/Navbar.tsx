import React from 'react';
import { Rocket, Satellite, Activity } from 'lucide-react';

interface NavbarProps {
  missionCount: number;
  engineOnline: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ missionCount, engineOnline }) => {
  return (
    <header className="h-14 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-6 flex items-center justify-between z-30 select-none">
      {/* Brand & Mission Program */}
      <div className="flex items-center gap-4">
        {/* NASA Insignia Orb */}
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-900 flex items-center justify-center shadow-sm">
          <Rocket className="w-4 h-4 text-white transform -rotate-45" />
        </div>

        <div>
          <h1 className="text-sm font-semibold text-white tracking-tight">
            NASA CLPS <span className="text-slate-400 font-normal">Lunar Mission Browser</span>
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Commercial Lunar Payload Services • 3D Surface Topography
          </p>
        </div>
      </div>

      {/* Ephemeris Engine Status */}
      <div className="flex items-center gap-4 text-xs">
        <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-400">
          <Satellite className="w-3.5 h-3.5 text-slate-500" />
          <span>IAU Moon 2000</span>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-slate-500 hidden sm:inline">Missions:</span>
          <span className="font-semibold text-white">{missionCount}</span>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <Activity className={`w-3.5 h-3.5 ${engineOnline ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className={`font-medium ${engineOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
            {engineOnline ? 'Online' : 'Local'}
          </span>
        </div>
      </div>
    </header>
  );
};
