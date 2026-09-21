import { useState, useEffect, useCallback } from 'react';
import type { CLPSMission, AstroTelemetry, ForecastPoint } from './types/mission';
import { DEFAULT_MISSIONS } from './data/defaultMissions';
import { computeClientTelemetry, computeClientForecast } from './utils/clientAstroEngine';
import { Navbar } from './components/Navbar';
import { LunarGlobe } from './components/LunarGlobe';
import { MissionFilterBar } from './components/MissionFilterBar';
import { MissionDetailPanel } from './components/MissionDetailPanel';
import { TimelineControl } from './components/TimelineControl';
import { PanelLeftClose, PanelLeftOpen, SlidersHorizontal } from 'lucide-react';

export function App() {
  const [missions, setMissions] = useState<CLPSMission[]>(DEFAULT_MISSIONS);
  const [selectedMission, setSelectedMission] = useState<CLPSMission | null>(DEFAULT_MISSIONS[0]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState<boolean>(true);
  const [engineOnline, setEngineOnline] = useState<boolean>(false);
  const [telemetry, setTelemetry] = useState<AstroTelemetry | null>(null);
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);

  // UI Drawer states
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [detailOpen, setDetailOpen] = useState<boolean>(true);

  // 1. Check API Health and fetch backend missions if available
  useEffect(() => {
    let isMounted = true;
    const checkBackend = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          if (isMounted) setEngineOnline(true);
          const mRes = await fetch('/api/missions');
          if (mRes.ok) {
            const data = await mRes.json();
            if (isMounted && Array.isArray(data) && data.length > 0) {
              setMissions(data);
            }
          }
        } else {
          if (isMounted) setEngineOnline(false);
        }
      } catch {
        if (isMounted) setEngineOnline(false);
      }
    };
    checkBackend();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Real-time Live Clock interval
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 4000);
    return () => clearInterval(interval);
  }, [isLive]);

  // 3. Update Telemetry & Horizon Angles whenever selectedMission or currentDate changes
  const updateTelemetry = useCallback(async () => {
    if (!selectedMission) return;

    // Try backend API first
    if (engineOnline) {
      try {
        const res = await fetch('/api/astro/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: selectedMission.coordinates.latitude,
            longitude: selectedMission.coordinates.longitude,
            elevation_km: selectedMission.coordinates.elevation_km,
            timestamp_utc: currentDate.toISOString(),
          }),
        });

        if (res.ok) {
          const telemData = await res.json();
          setTelemetry(telemData);
          return;
        }
      } catch {
        // Fallback to client engine
      }
    }

    // Client-side high-precision IAU calculation fallback
    const clientTelem = computeClientTelemetry(
      selectedMission.coordinates.latitude,
      selectedMission.coordinates.longitude,
      currentDate
    );
    setTelemetry(clientTelem);
  }, [selectedMission, currentDate, engineOnline]);

  useEffect(() => {
    updateTelemetry();
  }, [updateTelemetry]);

  // 4. Update Synodic Month Forecast whenever selectedMission changes
  useEffect(() => {
    if (!selectedMission) return;

    const fetchForecast = async () => {
      if (engineOnline) {
        try {
          const res = await fetch(`/api/astro/forecast/${selectedMission.mission_id}?days=29.53`);
          if (res.ok) {
            const fData = await res.json();
            if (fData.forecast_points) {
              setForecast(fData.forecast_points);
              return;
            }
          }
        } catch {
          // Fallback to client
        }
      }

      // Client calculation fallback
      const clientPoints = computeClientForecast(
        selectedMission.coordinates.latitude,
        selectedMission.coordinates.longitude,
        currentDate
      );
      setForecast(clientPoints);
    };

    fetchForecast();
  }, [selectedMission, engineOnline, currentDate]);

  // Handlers
  const handleSelectMission = useCallback((mission: CLPSMission) => {
    setSelectedMission(mission);
    setDetailOpen(true);
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Navbar */}
      <Navbar missionCount={missions.length} engineOnline={engineOnline} />

      {/* Main 3D Lunar Workspace */}
      <div className="flex-1 relative overflow-hidden flex">
        {/* Left Drawer: Mission Filter & List */}
        {sidebarOpen && (
          <MissionFilterBar
            missions={missions}
            selectedMission={selectedMission}
            onSelectMission={handleSelectMission}
          />
        )}

        {/* 3D Lunar Globe Canvas Centerpiece */}
        <main className="flex-1 h-full relative" aria-label="3D Lunar Geospatial Viewer">
          <LunarGlobe
            missions={missions}
            selectedMission={selectedMission}
            onSelectMission={handleSelectMission}
            telemetry={telemetry}
          />

          {/* Sidebar Toggle Button Floating */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute top-4 left-4 z-20 p-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 text-slate-300 hover:text-white shadow-2xl transition-all"
            title={sidebarOpen ? 'Collapse mission catalog' : 'Expand mission catalog'}
            style={{ left: sidebarOpen ? 'calc(360px + 12px)' : '16px' }}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>

          {/* Detail Drawer Toggle Button Floating (if detail is closed) */}
          {!detailOpen && selectedMission && (
            <button
              onClick={() => setDetailOpen(true)}
              className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-cyan-500/50 text-cyan-300 hover:bg-slate-800 shadow-2xl text-xs font-semibold"
              title="Open mission telemetry drawer"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Telemetry: {selectedMission.lander_name}</span>
            </button>
          )}

          {/* Floating Bottom Orbital Timeline Scrubber */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-3xl z-20">
            <TimelineControl
              currentDate={currentDate}
              onChangeDate={(d) => {
                setIsLive(false);
                setCurrentDate(d);
              }}
              isLive={isLive}
              onToggleLive={() => {
                const nextLive = !isLive;
                setIsLive(nextLive);
                if (nextLive) setCurrentDate(new Date());
              }}
            />
          </div>
        </main>

        {/* Right Drawer: Mission Telemetry & Science Details */}
        {detailOpen && selectedMission && (
          <MissionDetailPanel
            mission={selectedMission}
            onClose={() => setDetailOpen(false)}
            telemetry={telemetry}
            forecast={forecast}
          />
        )}
      </div>
    </div>
  );
}

export default App;
