import {
  MI_TO_KM,
  NEARBY_RADIUS_MI,
  VISIBLE_MAX_DISTANCE_MI,
  VISIBLE_MIN_ELEVATION_DEG,
} from "./config";

export interface VisibilityCriteria {
  maxDistanceKm: number;
  minElevationDeg: number;
  minAltitudeM?: number;
}

export function visibilityCriteria(onlyVisible: boolean): VisibilityCriteria {
  if (onlyVisible) {
    return {
      maxDistanceKm: VISIBLE_MAX_DISTANCE_MI * MI_TO_KM,
      minElevationDeg: VISIBLE_MIN_ELEVATION_DEG,
    };
  }
  return {
    maxDistanceKm: NEARBY_RADIUS_MI * MI_TO_KM,
    minElevationDeg: -90,
    minAltitudeM: 0,
  };
}

export const FETCH_RADIUS_KM = Math.max(NEARBY_RADIUS_MI, VISIBLE_MAX_DISTANCE_MI) * MI_TO_KM;
