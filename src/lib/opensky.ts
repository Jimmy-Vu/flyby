import {
  airlineFromCallsign,
  isKnownAirlineCallsign,
  isLikelyCommercialFlight,
  militaryServiceAbbreviation,
  type Flight,
} from "./flight";
import type { VisibilityCriteria } from "./visibility";
import {
  geoBearingDeg,
  geoBoundingBox,
  geoDistanceKm,
  geoElevationDeg,
  geoIsVisibleOverhead,
  type GeoCoord,
} from "./geo";

type StateVector = Array<string | number | boolean | null | number[]>;

export interface StatesResponse {
  time: number;
  states: StateVector[] | null;
}

const str = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";
const num = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

function statesParams(observer: GeoCoord, radiusKm: number): URLSearchParams {
  const box = geoBoundingBox(observer, radiusKm);
  return new URLSearchParams({
    lamin: box.lamin.toFixed(6),
    lamax: box.lamax.toFixed(6),
    lomin: box.lomin.toFixed(6),
    lomax: box.lomax.toFixed(6),
    extended: "1",
  });
}

export function parseStates(
  response: StatesResponse,
  observer: GeoCoord,
  criteria: VisibilityCriteria,
): Flight[] {
  const flights: Flight[] = [];

  for (const state of response.states ?? []) {
    if (state[8] !== false) continue;

    const lat = num(state[6]);
    const lon = num(state[5]);
    if (lat === 0 && lon === 0) continue;

    const callsign = str(state[1]);
    const emitterCategory = num(state[17]);
    const altitudeM = num(state[7]) || num(state[13]);

    const distanceKm = geoDistanceKm(observer, { lat, lon });
    const elevationDeg = geoElevationDeg(distanceKm, altitudeM);

    if (
      !geoIsVisibleOverhead(
        distanceKm,
        altitudeM,
        criteria.minElevationDeg,
        criteria.maxDistanceKm,
        criteria.minAltitudeM,
      )
    ) {
      continue;
    }

    const flight: Flight = {
      icao24: str(state[0]),
      callsign,
      registration: "",
      registeredOwner: "",
      badgeLabel: "",
      airline: "",
      flightNumber: "",
      origin: "",
      destination: "",
      aircraftType: "",
      kind: "private",
      emitterCategory,
      lat,
      lon,
      altitudeM,
      velocityMs: num(state[9]),
      headingDeg: num(state[10]),
      bearingDeg: geoBearingDeg(observer, { lat, lon }),
      distanceKm,
      elevationDeg,
    };

    const military = militaryServiceAbbreviation(callsign, "");
    if (military) {
      flight.kind = "military";
      flight.badgeLabel = military;
      flight.airline = "Military aircraft";
    } else if (emitterCategory === 8) {
      flight.kind = "helicopter";
      flight.badgeLabel = "HEL";
      flight.airline = "Helicopter";
    } else if (
      isKnownAirlineCallsign(callsign) ||
      (emitterCategory >= 4 &&
        emitterCategory <= 6 &&
        isLikelyCommercialFlight(callsign, false))
    ) {
      flight.kind = "commercial";
      flight.airline = airlineFromCallsign(callsign);
    } else {
      flight.kind = "private";
      flight.badgeLabel = "PVT";
      flight.airline = "Private aircraft";
    }

    flights.push(flight);
  }

  return flights;
}

export async function fetchStates(observer: GeoCoord, radiusKm: number): Promise<StatesResponse> {
  const params = statesParams(observer, radiusKm);

  let res = await fetch(`/api/opensky/states?${params}`).catch(() => null);
  const proxyWorked = res?.ok && res.headers.get("content-type")?.includes("json");
  if (!res || !proxyWorked) {
    res = await fetch(`https://opensky-network.org/api/states/all?${params}`);
  }

  if (!res.ok) {
    throw new Error(
      res.status === 429
        ? "OpenSky rate limit reached. Try a longer refresh interval."
        : `OpenSky request failed (HTTP ${res.status})`,
    );
  }
  return (await res.json()) as StatesResponse;
}
