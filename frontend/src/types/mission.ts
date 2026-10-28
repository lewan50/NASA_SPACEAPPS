export interface LunarCoordinate {
  latitude: number;          // Deg [-90.0, 90.0]
  longitude: number;         // Deg [-180.0, 180.0] IAU standard
  elevation_km: number;      // km relative to 1737.4 km sphere
  is_confirmed: boolean;     // False indicates "Target Candidate Region"
  designation: string;       // "Confirmed Landing Site" | "Target Candidate Region"
}

export interface CLPSPayload {
  payload_id: string;
  name: string;
  acronym?: string;
  agency_or_institution: string;
  mass_kg?: number;
  objective: string;
  instrument_type: string;
}

export interface LanderSpecs {
  propellant?: string;
  payload_capacity_kg?: number;
  height_m?: number;
  diameter_m?: number;
  power_generation_w?: number;
  primary_comms?: string;
}

export interface CLPSMission {
  mission_id: string;
  task_order: string;
  vendor: string;
  lander_name: string;
  target_region: string;
  coordinates: LunarCoordinate;
  launch_date?: string;
  landing_date?: string;
  status: 'Landed' | 'Upcoming' | 'Cancelled' | 'Anomaly';
  lander_specs: LanderSpecs;
  payload_array: CLPSPayload[];
  summary: string;
}

export interface AstroTelemetry {
  timestamp_utc: string;
  julian_date: number;
  days_since_j2000: number;
  subsolar_point: {
    latitude: number;
    longitude: number;
    distance_km: number;
  };
  subearth_point: {
    latitude: number;
    longitude: number;
    distance_km: number;
  };
  solar_horizon: {
    azimuth_deg: number;
    elevation_deg: number;
    illumination_state: string;
    surface_illumination_percent: number;
  };
  earth_horizon: {
    azimuth_deg: number;
    elevation_deg: number;
    dte_status: string;
    direct_los: boolean;
    light_travel_time_sec: number;
  };
}

export interface ForecastPoint {
  elapsed_days: number;
  sun_elevation_deg: number;
  earth_elevation_deg: number;
  is_illuminated: boolean;
  has_dte: boolean;
}
