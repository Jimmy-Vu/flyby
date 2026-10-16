export interface RouteDetails {
  registration: string;
  registeredOwner: string;
  aircraftType: string;
  airlineName: string;
  flightNumber: string;
  origin: string;
  destination: string;
}

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const obj = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;

export function compactAirportName(name: string): string {
  const compact = name
    .replace(/\b(International|Intl\.?|Airport|Airfield)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return compact || name;
}

export function airportLabel(name: string, city: string, code: string): string {
  const place = city || compactAirportName(name);
  if (!place) return code;
  if (!code) return place;
  return `${place} (${code})`;
}

function airportFrom(value: unknown): string {
  const airport = obj(value);
  return airportLabel(
    str(airport?.name),
    str(airport?.municipality),
    str(airport?.iata_code) || str(airport?.icao_code),
  );
}

export function parseAdsbDb(body: unknown): RouteDetails | null {
  const response = obj(obj(body)?.response);
  const aircraft = obj(response?.aircraft);
  const route = obj(response?.flightroute);

  const origin = airportFrom(route?.origin);
  const destination = airportFrom(route?.destination);
  const hasRoute = origin !== "" && destination !== "";

  const details: RouteDetails = {
    registration: str(aircraft?.registration),
    registeredOwner: str(aircraft?.registered_owner),
    aircraftType: str(aircraft?.type) || str(aircraft?.icao_type),
    airlineName: str(obj(route?.airline)?.name),
    flightNumber: str(route?.callsign_iata),
    origin: hasRoute ? origin : "",
    destination: hasRoute ? destination : "",
  };
  return Object.values(details).some(Boolean) ? details : null;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  return res.ok ? res.json() : null;
}

export async function fetchAdsbDbDetails(
  icao24: string,
  callsign: string,
): Promise<RouteDetails | null> {
  const call = callsign.trim();

  if (icao24) {
    const query = call ? `?callsign=${encodeURIComponent(call)}` : "";
    const byAircraft = parseAdsbDb(
      await getJson(`https://api.adsbdb.com/v0/aircraft/${encodeURIComponent(icao24)}${query}`),
    );
    if (byAircraft) return byAircraft;
  }

  if (!call) return null;
  return parseAdsbDb(await getJson(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(call)}`));
}
