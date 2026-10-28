import { useState, useEffect, useCallback } from 'react';
import type { CLPSMission, AstroTelemetry, ForecastPoint } from './types/mission';
import { DEFAULT_MISSIONS } from './data/defaultMissions';
import { computeClientTelemetry, computeClientForecast } from './utils/clientAstroEngine';
import { validateMissions } from './utils/missionValidation';
import { Navbar } from './components/Navbar';
import { LunarGlobe } from './components/LunarGlobe';
import { MissionFilterBar } from './components/MissionFilterBar';
import { MissionDetailPanel } from './components/MissionDetailPanel';
import { TimelineControl } from './components/TimelineControl';
import { PanelLeftClose, PanelLeftOpen, SlidersHorizontal } from 'lucide-react';
import { GlobeErrorBoundary } from './components/GlobeErrorBoundary';

export function App() {
  // Validate missions on initialization to prevent rendering invalid data
  const [missions, setMissions] = useState<CLPSMission[]>(() => validateMissions(DEFAULT_MISSIONS));
  const [selectedMission, setSelectedMission] = useState<CLPSMission | null>(() => {
    const validated = validateMissions(DEFAULT_MISSIONS);
    return validated.length > 0 ? validated[0] : null;
  });
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState<boolean>(true);
  const [engineOnline, setEngineOnline] = useState<boolean>(false);
  const [telemetry, setTelemetry] = useState<AstroTelemetry | null>(null);
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);

  // UI Drawer states
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [detailOpen, setDetailOpen] = useState<boolean>(true);

  // Responsive: auto-close panels on small screens
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 1024) {
        // Medium screens: close detail panel, keep sidebar
        setDetailOpen(false);
      }
      if (width < 768) {
        // Small screens: close both panels
        setSidebarOpen(false);
        setDetailOpen(false);
      }
    };
    handleResize(); // Check on mount
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
              // Validate backend missions before using them
              const validatedData = validateMissions(data);
              if (validatedData.length > 0) {
                setMissions(validatedData);
              }
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
  // Stable identity: LunarGlobe re-initializes the whole WebGL scene when this prop changes,
  // so it must NOT be recreated on every App re-render (telemetry ticks every ~4s).
  const handleSelectMission = useCallback((mission: CLPSMission) => {
    setSelectedMission(mission);
    setDetailOpen(true);
  }, []);

  // Stable callbacks for TimelineControl — prevents playback interval churn on every render.
  const handleChangeDate = useCallback((d: Date) => {
    setIsLive(false);
    setCurrentDate(d);
  }, []);

  const handleToggleLive = useCallback(() => {
    const nextLive = !isLive;
    setIsLive(nextLive);
    if (nextLive) setCurrentDate(new Date());
  }, [isLive]);

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
        <main className="flex-1 min-w-0 h-full relative" aria-label="3D Lunar Geospatial Viewer">
          <GlobeErrorBoundary>
            <LunarGlobe
              missions={missions}
              selectedMission={selectedMission}
              onSelectMission={handleSelectMission}
              telemetry={telemetry}
            />
          </GlobeErrorBoundary>

          {/* Sidebar Toggle Button Floating */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute top-4 z-20 p-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 text-slate-300 hover:text-white shadow-2xl transition-all"
            title={sidebarOpen ? 'Collapse mission catalog' : 'Expand mission catalog'}
            style={{ left: sidebarOpen ? 'calc(280px + 12px)' : '16px' }}
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
              <span className="hidden sm:inline">Telemetry: {selectedMission.lander_name}</span>
              <span className="sm:hidden">Telemetry</span>
            </button>
          )}

          {/* Floating Bottom Orbital Timeline Scrubber — responsive width */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[90vw] max-w-[720px]">
            <TimelineControl
              currentDate={currentDate}
              onChangeDate={handleChangeDate}
              isLive={isLive}
              onToggleLive={handleToggleLive}
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
