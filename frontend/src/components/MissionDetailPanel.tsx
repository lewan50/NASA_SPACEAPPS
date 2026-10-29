import React, { useState } from 'react';
import type { CLPSMission, AstroTelemetry, ForecastPoint } from '../types/mission';
import { TelemetryGauges } from './TelemetryGauges';
import {
  X,
  Rocket,
  Compass,
  Layers,
  Cpu,
  Calendar,
  ShieldCheck,
  AlertCircle,
  Activity,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Sun,
} from 'lucide-react';

interface MissionDetailPanelProps {
  mission: CLPSMission;
  onClose: () => void;
  telemetry: AstroTelemetry | null;
  forecast: ForecastPoint[];
}

export const MissionDetailPanel: React.FC<MissionDetailPanelProps> = ({
  mission,
  onClose,
  telemetry,
  forecast,
}) => {
  const [activeTab, setActiveTab] = useState<'telemetry' | 'payloads' | 'specs'>('telemetry');

  // Collapsible section state for telemetry tab
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    summary: true,
    gauges: true,
    forecast: true,
    dates: false,
    payloads: true,
    specs: true,
  });
  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Reusable collapsible accordion row
  const Section = ({
    id,
    icon: Icon,
    title,
    badge,
    children,
    defaultOpen = true,
  }: {
    id: string;
    icon: React.ElementType;
    title: string;
    badge?: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
  }) => {
    const isOpen = openSections[id] ?? defaultOpen;
    return (
      <div className="bg-slate-900/40 border border-white/5 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/30 transition-colors group"
        >
          <div className="flex items-center gap-2.5 text-sm font-medium text-slate-200">
            <Icon className="w-4 h-4 text-slate-500" />
            <span>{title}</span>
          </div>
          <div className="flex items-center gap-2">
            {badge}
            {isOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
            )}
          </div>
        </button>
        {isOpen && <div className="px-4 pb-4">{children}</div>}
      </div>
    );
  };

  // Format coordinates to standard planetary notation
  const latStr = `${Math.abs(mission.coordinates.latitude).toFixed(2)}° ${mission.coordinates.latitude >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(mission.coordinates.longitude).toFixed(2)}° ${mission.coordinates.longitude >= 0 ? 'E' : 'W'}`;

  return (
    <aside
      aria-label="Mission Details"
      className="w-[420px] lg:w-[420px] md:w-[340px] shrink-0 h-full bg-slate-950/60 backdrop-blur-xl border-l border-white/5 flex flex-col z-20 overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 border-b border-white/5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
          title="Close Drawer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-mono text-slate-500">
            {mission.task_order}
          </span>
          <span
            className={`text-[11px] font-medium ${
              mission.status === 'Landed'
                ? 'text-emerald-400'
                : mission.status === 'Upcoming'
                ? 'text-blue-400'
                : mission.status === 'Cancelled'
                ? 'text-slate-400'
                : 'text-orange-400'
            }`}
          >
            {mission.status}
          </span>
        </div>

        <h2 className="text-lg font-semibold text-white tracking-tight">
          {mission.lander_name}
        </h2>

        <div className="text-sm text-slate-400 mt-1">
          <span className="font-medium text-slate-300">{mission.vendor}</span>
          <span className="mx-1.5">•</span>
          <span>{mission.target_region}</span>
        </div>

        {/* Standard Planetary Coordinates Banner */}
        <div className="mt-4 bg-slate-900/40 p-3 rounded-lg border border-white/5">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-slate-500" />
              <span>Landing Coordinates</span>
            </span>
            <span
              className={`text-[10px] font-medium flex items-center gap-1 ${
                mission.coordinates.is_confirmed
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }`}
            >
              {mission.coordinates.is_confirmed ? (
                <ShieldCheck className="w-3 h-3" />
              ) : (
                <AlertCircle className="w-3 h-3" />
              )}
              <span>{mission.coordinates.designation}</span>
            </span>
          </div>

          <div className="font-mono text-slate-200 text-sm flex items-center justify-between">
            <span>{latStr}, {lonStr}</span>
            <span className="text-slate-500 text-xs">
              {mission.coordinates.elevation_km >= 0 ? '+' : ''}
              {mission.coordinates.elevation_km.toFixed(2)} km
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 text-sm">
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'telemetry'
              ? 'border-cyan-500 text-cyan-400 font-medium'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Telemetry</span>
        </button>

        <button
          onClick={() => setActiveTab('payloads')}
          className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'payloads'
              ? 'border-cyan-500 text-cyan-400 font-medium'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Payloads ({mission.payload_array.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('specs')}
          className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'specs'
              ? 'border-cyan-500 text-cyan-400 font-medium'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Specs</span>
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* TAB 1: TELEMETRY & HORIZON */}
        {activeTab === 'telemetry' && (
          <div className="space-y-3">
            {/* Mission Summary */}
            <Section id="summary" icon={Activity} title="Mission Summary">
              <p className="text-sm text-slate-300 leading-relaxed">
                {mission.summary}
              </p>
            </Section>

            {/* Real-Time Horizon Gauges */}
            <Section
              id="gauges"
              icon={Sun}
              title="Solar Horizon & Comms"
              badge={
                telemetry?.earth_horizon.direct_los ? (
                  <span className="text-[10px] font-medium text-emerald-400">
                    LOS Active
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-amber-400">
                    No LOS
                  </span>
                )
              }
            >
              <TelemetryGauges telemetry={telemetry} coordinates={mission.coordinates} />
            </Section>

            {/* 29.5-Day Synodic Solar Elevation Forecast Chart */}
            <Section id="forecast" icon={TrendingUp} title="29.5-Day Solar Elevation Profile"
              badge={<span className="text-[10px] text-slate-500">Diurnal Cycle</span>}
            >
              {forecast.length > 0 ? (
                <div className="mt-2">
                  {/* Miniature SVG Curve */}
                  <div className="h-28 w-full bg-slate-900/40 rounded-lg p-3 border border-white/5 relative flex flex-col justify-end">
                    {/* Horizon 0° reference line */}
                    <div className="absolute left-3 right-3 top-1/2 border-b border-dashed border-slate-700 pointer-events-none" />
                    <div className="absolute right-4 top-[46%] text-[10px] font-mono text-slate-500">
                      0° Horizon
                    </div>

                    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 60">
                      <defs>
                        <linearGradient id="solarGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Line Points */}
                      {(() => {
                        const minEl = -20;
                        const maxEl = 90;
                        const points = forecast
                          .map((pt, idx) => {
                            const x = (idx / (forecast.length - 1)) * 100;
                            // Map elevation to y: minEl -> 60, maxEl -> 0, clamped to viewBox
                            const rawY = 60 - ((pt.sun_elevation_deg - minEl) / (maxEl - minEl)) * 60;
                            const y = Math.max(0, Math.min(60, rawY));
                            return `${x},${y}`;
                          })
                          .join(' ');

                        return (
                          <>
                            <polyline
                              fill="none"
                              stroke="#f59e0b"
                              strokeWidth="1.5"
                              points={points}
                            />
                          </>
                        );
                      })()}
                    </svg>

                    <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-2">
                      <span>Day 0</span>
                      <span>Day 15 (Solar Noon)</span>
                      <span>Day 29.5 (Night)</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 mt-3">
                    Shows solar incidence angle above the local tangent plane over one full lunar day/night cycle.
                  </div>
                </div>
              ) : (
                <div className="text-center text-sm text-slate-500 py-6">
                  Loading lunar synodic cycle ephemeris...
                </div>
              )}
            </Section>

            {/* Launch / Landing Dates */}
            <Section id="dates" icon={Calendar} title="Launch & Landing Timeline" defaultOpen={false}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-900/40 p-3 rounded-lg border border-white/5">
                  <div className="text-slate-500 text-xs flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-600" />
                    <span>Launch Date</span>
                  </div>
                  <div className="font-mono text-slate-200">
                    {mission.launch_date ? new Date(mission.launch_date).toLocaleDateString() : 'TBD'}
                  </div>
                </div>

                <div className="bg-slate-900/40 p-3 rounded-lg border border-white/5">
                  <div className="text-slate-500 text-xs flex items-center gap-1.5 mb-1">
                    <Rocket className="w-3.5 h-3.5 text-slate-600" />
                    <span>Landing Date</span>
                  </div>
                  <div className="font-mono text-slate-200">
                    {mission.landing_date ? new Date(mission.landing_date).toLocaleDateString() : 'TBD'}
                  </div>
                </div>
              </div>
            </Section>
          </div>
        )}

        {/* TAB 2: SCIENTIFIC PAYLOADS */}
        {activeTab === 'payloads' && (
          <div className="space-y-2">
            <div className="text-sm text-slate-400 px-1">
              NASA Science Mission Directorate (SMD) & commercial research instruments manifest:
            </div>

            {mission.payload_array.map((p, idx) => (
              <div
                key={p.payload_id}
                className="bg-slate-900/40 border border-white/5 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleSection(`payload-${idx}`)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/30 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    {p.acronym && (
                      <span className="bg-cyan-500/10 text-cyan-400 font-mono text-[10px] px-2 py-0.5 rounded">
                        {p.acronym}
                      </span>
                    )}
                    <span className="text-sm font-medium text-slate-100">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.mass_kg && (
                      <span className="text-[10px] font-mono text-amber-400">
                        {p.mass_kg} kg
                      </span>
                    )}
                    {openSections[`payload-${idx}`] !== false ? (
                      <ChevronUp className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                    )}
                  </div>
                </button>
                {openSections[`payload-${idx}`] !== false && (
                  <div className="px-4 pb-3 space-y-2">
                    <div className="text-xs text-slate-500">{p.agency_or_institution}</div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {p.objective}
                    </p>
                    <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                      Category: {p.instrument_type}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: LANDER SPECS & AVIONICS */}
        {activeTab === 'specs' && (
          <div className="space-y-3">
            <Section id="specs" icon={Cpu} title="Flight Platform Architecture">
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-900/40 border border-white/5">
                    <div className="text-slate-500 text-[11px]">Propulsion System</div>
                    <div className="font-medium text-slate-200 mt-1">{mission.lander_specs.propellant || 'N/A'}</div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/40 border border-white/5">
                    <div className="text-slate-500 text-[11px]">Payload Mass Capacity</div>
                    <div className="font-medium text-slate-200 mt-1">
                      {mission.lander_specs.payload_capacity_kg ? `${mission.lander_specs.payload_capacity_kg} kg` : 'N/A'}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/40 border border-white/5">
                    <div className="text-slate-500 text-[11px]">Solar Power Generation</div>
                    <div className="font-medium text-slate-200 mt-1">
                      {mission.lander_specs.power_generation_w ? `${mission.lander_specs.power_generation_w} W` : 'N/A'}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/40 border border-white/5">
                    <div className="text-slate-500 text-[11px]">Dimensions (H × Ø)</div>
                    <div className="font-medium text-slate-200 mt-1">
                      {mission.lander_specs.height_m}m × {mission.lander_specs.diameter_m}m
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/40 border border-white/5 text-sm">
                  <div className="text-slate-500 text-[11px]">RF Telemetry & Communications</div>
                  <div className="font-medium text-slate-200 mt-1">{mission.lander_specs.primary_comms || 'Deep Space Network compatible'}</div>
                </div>
              </div>
            </Section>
          </div>
        )}
      </div>
    </aside>
  );
};
