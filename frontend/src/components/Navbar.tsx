import React from 'react';
import { Rocket, Satellite, Activity } from 'lucide-react';

interface NavbarProps {
  missionCount: number;
  engineOnline: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ missionCount, engineOnline }) => {
  return (
    <header className="h-16 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between z-30 select-none">
      {/* Brand & Mission Program */}
      <div className="flex items-center gap-3">
        {/* NASA Insignia Orb */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-700 via-indigo-900 to-slate-950 p-0.5 border border-cyan-500/40 shadow-lg shadow-cyan-950/50 flex items-center justify-center shrink-0">
          <Rocket className="w-5 h-5 text-cyan-300 transform -rotate-45" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm md:text-base font-extrabold text-white tracking-wider flex items-center gap-2">
              <span>NASA CLPS</span>
              <span className="text-cyan-400 font-medium">LUNAR MISSION BROWSER</span>
            </h1>
            <span className="hidden md:inline-block text-[10px] font-mono font-bold bg-cyan-950 text-cyan-400 border border-cyan-800/60 px-2 py-0.2 rounded">
              ARTEMIS
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Commercial Lunar Payload Services • 3D Surface Topography & Astro Ephemeris Engine
          </p>
        </div>
      </div>

      {/* Ephemeris Engine Status & Planetary Reference Standard */}
      <div className="flex items-center gap-2 md:gap-3 text-xs">
        <div className="hidden xl:flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300">
          <Satellite className="w-3.5 h-3.5 text-amber-400" />
          <span>Datum: IAU Moon 2000 (R = 1,737.4 km)</span>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-800 text-[11px]">
          <span className="text-slate-400 hidden sm:inline">Missions:</span>
          <span className="font-mono font-bold text-white bg-slate-800 px-1.5 py-0.2 rounded">
            {missionCount}
          </span>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-800 text-[11px]">
          <Activity className={`w-3.5 h-3.5 ${engineOnline ? 'text-emerald-400' : 'text-amber-400'} animate-pulse`} />
          <span className="hidden md:inline text-slate-300">Astro API:</span>
          <span className={`font-semibold font-mono ${engineOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
            {engineOnline ? 'ONLINE' : 'LOCAL'}
          </span>
        </div>
      </div>
    </header>
  );
};
