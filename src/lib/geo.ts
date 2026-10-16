export interface GeoCoord {
  lat: number;
  lon: number;
}

export interface BoundingBox {
  lamin: number;
  lamax: number;
  lomin: number;
  lomax: number;
}

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE_LAT = 111.195;
const DEG_TO_RAD = Math.PI / 180;

export function geoDistanceKm(a: GeoCoord, b: GeoCoord): number {
  const dLat = (b.lat - a.lat) * DEG_TO_RAD;
  const dLon = (b.lon - a.lon) * DEG_TO_RAD;
  const lat1 = a.lat * DEG_TO_RAD;
  const lat2 = b.lat * DEG_TO_RAD;

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function geoBearingDeg(from: GeoCoord, to: GeoCoord): number {
  const lat1 = from.lat * DEG_TO_RAD;
  const lat2 = to.lat * DEG_TO_RAD;
  const dLon = (to.lon - from.lon) * DEG_TO_RAD;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) / DEG_TO_RAD + 360) % 360;
}

export function geoElevationDeg(distanceKm: number, altitudeM: number): number {
  if (distanceKm <= 0.01) return 90;
  return (Math.atan2(altitudeM, distanceKm * 1000) * 180) / Math.PI;
}

export function geoIsVisibleOverhead(
  distanceKm: number,
  altitudeM: number,
  minElevationDeg: number,
  maxDistanceKm: number,
  minAltitudeM = 150,
): boolean {
  if (altitudeM < minAltitudeM || distanceKm > maxDistanceKm) return false;
  return geoElevationDeg(distanceKm, altitudeM) >= minElevationDeg;
}

export function geoBoundingBox(center: GeoCoord, radiusKm: number): BoundingBox {
  const dLat = radiusKm / KM_PER_DEGREE_LAT;
  const cosLat = Math.max(0.01, Math.cos(center.lat * DEG_TO_RAD));
  const dLon = radiusKm / (KM_PER_DEGREE_LAT * cosLat);
  return {
    lamin: Math.max(-90, center.lat - dLat),
    lamax: Math.min(90, center.lat + dLat),
    lomin: Math.max(-180, center.lon - dLon),
    lomax: Math.min(180, center.lon + dLon),
  };
}
