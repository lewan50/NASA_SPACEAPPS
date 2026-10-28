import type { CLPSMission, LunarCoordinate } from '../types/mission';

/**
 * Validates lunar coordinates against IAU physical bounds.
 * Returns true if valid, false otherwise.
 */
export function validateCoordinate(coord: LunarCoordinate): boolean {
  return (
    coord.latitude >= -90 &&
    coord.latitude <= 90 &&
    coord.longitude >= -180 &&
    coord.longitude <= 180 &&
    Math.abs(coord.elevation_km) < 10 && // Sanity check: no extreme elevations
    Number.isFinite(coord.latitude) &&
    Number.isFinite(coord.longitude) &&
    Number.isFinite(coord.elevation_km)
  );
}

/**
 * Validates a complete mission object.
 * Returns an object with validation result and any error messages.
 */
export function validateMission(mission: CLPSMission): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate coordinates
  if (!validateCoordinate(mission.coordinates)) {
    errors.push(
      `Invalid coordinates: lat=${mission.coordinates.latitude}, lon=${mission.coordinates.longitude}, elev=${mission.coordinates.elevation_km}km`
    );
  }

  // Validate required string fields
  if (!mission.mission_id || mission.mission_id.trim() === '') {
    errors.push('Missing mission_id');
  }
  if (!mission.lander_name || mission.lander_name.trim() === '') {
    errors.push('Missing lander_name');
  }
  if (!mission.vendor || mission.vendor.trim() === '') {
    errors.push('Missing vendor');
  }

  // Validate date chronology (if both dates present)
  if (mission.launch_date && mission.landing_date) {
    const launch = new Date(mission.launch_date);
    const landing = new Date(mission.landing_date);
    if (landing < launch) {
      errors.push(`Landing date before launch date: ${mission.landing_date} < ${mission.launch_date}`);
    }
    // Sanity check: no missions from the future or before space age
    const now = new Date();
    const spaceAgeStart = new Date('1957-01-01');
    if (launch > now || launch < spaceAgeStart) {
      errors.push(`Launch date out of range: ${mission.launch_date}`);
    }
  }

  // Validate status
  const validStatuses = ['Landed', 'Upcoming', 'Cancelled', 'Anomaly'];
  if (!validStatuses.includes(mission.status)) {
    errors.push(`Invalid status: ${mission.status} (expected one of: ${validStatuses.join(', ')})`);
  }

  // Validate payload array
  if (!Array.isArray(mission.payload_array)) {
    errors.push('payload_array is not an array');
  } else {
    mission.payload_array.forEach((payload, idx) => {
      if (!payload.payload_id) {
        errors.push(`Payload ${idx}: missing payload_id`);
      }
      if (!payload.name) {
        errors.push(`Payload ${idx}: missing name`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates an array of missions and logs warnings for any invalid entries.
 * Returns the filtered array of valid missions.
 */
export function validateMissions(missions: CLPSMission[]): CLPSMission[] {
  const validMissions: CLPSMission[] = [];

  missions.forEach((mission) => {
    const result = validateMission(mission);
    if (result.valid) {
      validMissions.push(mission);
    } else {
      console.warn(
        `[Mission Validation] ${mission.mission_id || 'unknown'} failed validation:`,
        result.errors
      );
    }
  });

  if (validMissions.length < missions.length) {
    console.warn(
      `[Mission Validation] ${missions.length - validMissions.length} of ${missions.length} missions failed validation and were excluded`
    );
  }

  return validMissions;
}
