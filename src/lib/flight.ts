export type FlightKind = "commercial" | "helicopter" | "military" | "private";

export interface Flight {
  icao24: string;
  callsign: string;
  registration: string;
  registeredOwner: string;
  badgeLabel: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  aircraftType: string;
  kind: FlightKind;
  emitterCategory: number;
  lat: number;
  lon: number;
  altitudeM: number;
  velocityMs: number;
  headingDeg: number;
  bearingDeg: number;
  distanceKm: number;
  elevationDeg: number;
}

export type FlightDetails = Partial<
  Pick<
    Flight,
    | "registration"
    | "registeredOwner"
    | "badgeLabel"
    | "airline"
    | "flightNumber"
    | "origin"
    | "destination"
    | "aircraftType"
    | "kind"
  >
>;

const AIRLINES: Record<string, string> = {
  AAL: "American",
  UAL: "United",
  DAL: "Delta",
  SWA: "Southwest",
  ASA: "Alaska",
  JBU: "JetBlue",
  FFT: "Frontier",
  AAY: "Allegiant",
  MXY: "Breeze",
  VXP: "Avelo",
  SCX: "Sun Country",
  WJA: "WestJet",
  JSX: "JSX",
  SKW: "SkyWest",
  EDV: "Endeavor",
  RPA: "Republic",
  QXE: "Horizon",
  ENY: "Envoy",
  PDT: "Piedmont",
  ASH: "Mesa",
  JIA: "PSA Airlines",
  BAW: "British Airways",
  AFR: "Air France",
  DLH: "Lufthansa",
  KLM: "KLM",
  ACA: "Air Canada",
  AMX: "Aeromexico",
  VOI: "Volaris",
  HAL: "Hawaiian",
  VOZ: "Virgin Australia",
  QFA: "Qantas",
  CPA: "Cathay Pacific",
  ANA: "ANA",
  JAL: "JAL",
  KAL: "Korean Air",
  EVA: "EVA Air",
  CSN: "China Southern",
  CES: "China Eastern",
  UAE: "Emirates",
  QTR: "Qatar",
  ETD: "Etihad",
  SIA: "Singapore",
  CLX: "Cargolux",
  GTI: "Atlas Air",
  FDX: "FedEx",
  UPS: "UPS",
};

function airlinePrefix(callsign: string): string {
  return callsign.trim().slice(0, 3).toUpperCase();
}

export function airlineFromCallsign(callsign: string): string {
  const trimmed = callsign.trim();
  if (trimmed.length < 3) return "Unknown";
  const prefix = airlinePrefix(trimmed);
  return AIRLINES[prefix] ?? prefix;
}

export function isKnownAirlineCallsign(callsign: string): boolean {
  const trimmed = callsign.trim();
  if (trimmed.length < 3) return false;
  return airlinePrefix(trimmed) in AIRLINES;
}

export function isLikelyCommercialFlight(
  callsign: string,
  onGround: boolean,
): boolean {
  if (onGround) return false;

  const trimmed = callsign.trim();
  if (trimmed.length < 4) return false;

  if (trimmed.startsWith("N") && trimmed.length <= 6) return false;

  return /^[A-Za-z0-9]+$/.test(trimmed);
}

export function militaryServiceAbbreviation(
  callsign: string,
  registeredOwner: string,
): string {
  const owner = registeredOwner.toUpperCase();
  if (owner.includes("AIR FORCE")) return "USAF";
  if (owner.includes("MARINE CORPS")) return "USMC";
  if (owner.includes("COAST GUARD")) return "USCG";
  if (owner.includes("UNITED STATES NAVY") || owner.includes("US NAVY")) {
    return "USN";
  }
  if (owner.includes("UNITED STATES ARMY") || owner.includes("US ARMY")) {
    return "USA";
  }
  if (owner.includes("DEPARTMENT OF DEFENSE") || owner.includes(" MILITARY")) {
    return "MIL";
  }

  const call = callsign.trim().toUpperCase();
  if (call.startsWith("RCH")) return "USAF";
  if (call.startsWith("CNV")) return "USN";
  if (call.startsWith("PAT")) return "USA";
  return "";
}

export function applyDetails(flight: Flight, details?: FlightDetails): Flight {
  if (!details) return flight;
  const defined = Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined),
  );
  return { ...flight, ...defined };
}

export function selectBestVisibleFlight(flights: Flight[]): Flight | undefined {
  const better = (a: Flight, b: Flight | undefined) =>
    !b ||
    a.elevationDeg > b.elevationDeg ||
    (a.elevationDeg === b.elevationDeg && a.distanceKm < b.distanceKm);

  let bestCommercial: Flight | undefined;
  let bestOther: Flight | undefined;
  for (const flight of flights) {
    if (flight.kind === "commercial") {
      if (better(flight, bestCommercial)) bestCommercial = flight;
    } else if (better(flight, bestOther)) {
      bestOther = flight;
    }
  }
  return bestCommercial ?? bestOther;
}

export function compareFlights(a: Flight, b: Flight): number {
  const aCommercial = a.kind === "commercial";
  const bCommercial = b.kind === "commercial";
  if (aCommercial !== bCommercial) return aCommercial ? -1 : 1;
  if (a.elevationDeg !== b.elevationDeg) return b.elevationDeg - a.elevationDeg;
  return a.distanceKm - b.distanceKm;
}
