import { describe, expect, it } from "vitest";
import {
  airlineFromCallsign,
  militaryServiceAbbreviation,
  selectBestVisibleFlight,
  type Flight,
} from "./flight";
import {
  geoBearingDeg,
  geoBoundingBox,
  geoDistanceKm,
  geoElevationDeg,
  geoIsVisibleOverhead,
} from "./geo";
import { AIRLINE_LOGO_ASSETS } from "./airlineLogoData";
import { airlineCode, findAirlineLogo, logoPixels } from "./airlineLogos";
import { parseStates } from "./opensky";
import { FETCH_RADIUS_KM, visibilityCriteria } from "./visibility";
import { airportLabel, compactAirportName, parseAdsbDb } from "./routes";

const LAX = { lat: 33.9416, lon: -118.4085 };
const JFK = { lat: 40.6413, lon: -73.7781 };
const HOME = { lat: 33.8366, lon: -117.9143 };
const DEFAULTS = { maxDistanceKm: 45, minElevationDeg: 10 };

describe("geo", () => {
  it("computes great-circle distance", () => {
    expect(geoDistanceKm(LAX, JFK)).toBeCloseTo(3974, -1);
    expect(geoDistanceKm(LAX, LAX)).toBe(0);
  });

  it("computes elevation and visibility", () => {
    expect(geoElevationDeg(0, 1000)).toBe(90);
    expect(geoElevationDeg(10, 10000)).toBeCloseTo(45, 5);
    expect(geoIsVisibleOverhead(10, 10000, 10, 45)).toBe(true);
    expect(geoIsVisibleOverhead(50, 10000, 10, 45)).toBe(false);
    expect(geoIsVisibleOverhead(10, 100, 10, 45)).toBe(false);
    expect(geoIsVisibleOverhead(40, 3000, 10, 45)).toBe(false);
  });
});

describe("geoBearingDeg", () => {
  const origin = { lat: 10, lon: 20 };

  it("points to the compass direction of the target", () => {
    expect(geoBearingDeg(origin, { lat: 11, lon: 20 })).toBeCloseTo(0, 3);
    expect(geoBearingDeg(origin, { lat: 10, lon: 21 })).toBeCloseTo(90, 0);
    expect(geoBearingDeg(origin, { lat: 9, lon: 20 })).toBeCloseTo(180, 3);
    expect(geoBearingDeg(origin, { lat: 10, lon: 19 })).toBeCloseTo(270, 0);
  });

  it("stays between 0 and 360", () => {
    const bearing = geoBearingDeg(origin, { lat: 11, lon: 19 });
    expect(bearing).toBeGreaterThan(270);
    expect(bearing).toBeLessThan(360);
  });
});

describe("flight classification", () => {
  it("maps airline callsigns", () => {
    expect(airlineFromCallsign("UAL123")).toBe("United");
    expect(airlineFromCallsign("ZZZ9")).toBe("ZZZ");
    expect(airlineFromCallsign("")).toBe("Unknown");
  });

  it("detects military operators", () => {
    expect(militaryServiceAbbreviation("RCH401", "")).toBe("USAF");
    expect(militaryServiceAbbreviation("X", "US Navy")).toBe("USN");
  });
});

describe("parseStates", () => {
  const state = (overrides: Record<number, unknown> = {}) => {
    const base: unknown[] = [
      "abc123", "UAL123  ", "United States", 0, 0,
      -117.95, 33.8557, 3000, false, 200, 90, 0, null, 3100,
      null, false, 0, 4,
    ];
    for (const [i, v] of Object.entries(overrides)) base[Number(i)] = v;
    return base as never;
  };

  it("keeps visible airborne aircraft and classifies them", () => {
    const flights = parseStates({ time: 0, states: [state()] }, HOME, DEFAULTS);
    expect(flights).toHaveLength(1);
    expect(flights[0]).toMatchObject({
      icao24: "abc123",
      callsign: "UAL123",
      kind: "commercial",
      airline: "United",
    });
  });

  it("drops grounded, distant and low aircraft", () => {
    const flights = parseStates(
      {
        time: 0,
        states: [
          state({ 8: true }),
          state({ 5: -116, 6: 33 }),
          state({ 7: 50, 13: null }),
        ],
      },
      HOME,
      DEFAULTS,
    );
    expect(flights).toHaveLength(0);
  });

  it("classifies rotorcraft", () => {
    const [heli] = parseStates(
      { time: 0, states: [state({ 1: "LAPD12", 17: 8, 7: 2000 })] },
      HOME,
      DEFAULTS,
    );
    expect(heli).toMatchObject({ kind: "helicopter", badgeLabel: "HEL" });
  });
});

describe("parseStates visibility criteria", () => {
  const near = ["abc123", "UAL123", "", 0, 0, -117.95, 33.8557, 3000, false, 200, 90, 0, null, 3100, null, false, 0, 4];
  const far = ["def456", "DAL456", "", 0, 0, -117.7, 33.9557, 3000, false, 200, 90, 0, null, 3100, null, false, 0, 4];
  const response = { time: 0, states: [near, far] as never };
  const icaos = (criteria: { maxDistanceKm: number; minElevationDeg: number }) =>
    parseStates(response, HOME, criteria).map((f) => f.icao24);

  it("a lower angle lets in flatter, more distant aircraft", () => {
    expect(icaos({ maxDistanceKm: 45, minElevationDeg: 10 })).toEqual(["abc123"]);
    expect(icaos({ maxDistanceKm: 45, minElevationDeg: 5 })).toEqual(["abc123", "def456"]);
  });

  it("a higher angle keeps only aircraft nearly overhead", () => {
    expect(icaos({ maxDistanceKm: 45, minElevationDeg: 60 })).toEqual([]);
    expect(icaos({ maxDistanceKm: 45, minElevationDeg: 30 })).toEqual(["abc123"]);
  });

  it("a smaller radius drops distant aircraft", () => {
    expect(icaos({ maxDistanceKm: 10, minElevationDeg: 5 })).toEqual(["abc123"]);
    expect(icaos({ maxDistanceKm: 1, minElevationDeg: 0 })).toEqual([]);
  });

  it("applies the same limits to helicopters", () => {
    const heli = ["h1", "N911LA", "", 0, 0, -117.95, 33.8557, 600, false, 40, 90, 0, null, 650, null, false, 0, 8];
    const parse = (minElevationDeg: number) =>
      parseStates({ time: 0, states: [heli] as never }, HOME, { maxDistanceKm: 45, minElevationDeg });
    expect(parse(5)).toHaveLength(1);
    expect(parse(10)).toHaveLength(0);
  });
});

describe("geoBoundingBox", () => {
  it("contains the whole radius circle", () => {
    const box = geoBoundingBox(HOME, 50);
    for (const bearing of [0, 90, 180, 270]) {
      const rad = (bearing * Math.PI) / 180;
      const point = {
        lat: HOME.lat + (50 / 111.195) * Math.cos(rad),
        lon: HOME.lon + (50 / (111.195 * Math.cos((HOME.lat * Math.PI) / 180))) * Math.sin(rad),
      };
      expect(point.lat).toBeGreaterThanOrEqual(box.lamin - 1e-9);
      expect(point.lat).toBeLessThanOrEqual(box.lamax + 1e-9);
      expect(point.lon).toBeGreaterThanOrEqual(box.lomin - 1e-9);
      expect(point.lon).toBeLessThanOrEqual(box.lomax + 1e-9);
    }
  });

  it("is wider in longitude than latitude away from the equator", () => {
    const box = geoBoundingBox({ lat: 60, lon: 10 }, 100);
    expect(box.lomax - box.lomin).toBeGreaterThan(box.lamax - box.lamin);
  });

  it("clamps to valid coordinates", () => {
    const box = geoBoundingBox({ lat: 89.9, lon: 179.9 }, 500);
    expect(box.lamax).toBe(90);
    expect(box.lomax).toBe(180);
  });
});

describe("selectBestVisibleFlight", () => {
  const make = (partial: Partial<Flight>): Flight => ({
    icao24: "x",
    callsign: "",
    registration: "",
    registeredOwner: "",
    badgeLabel: "",
    airline: "",
    flightNumber: "",
    origin: "",
    destination: "",
    aircraftType: "",
    kind: "private",
    emitterCategory: 0,
    lat: 0,
    lon: 0,
    altitudeM: 0,
    velocityMs: 0,
    headingDeg: 0,
    bearingDeg: 0,
    distanceKm: 10,
    elevationDeg: 20,
    ...partial,
  });

  it("prefers commercial flights over higher non-commercial ones", () => {
    const best = selectBestVisibleFlight([
      make({ icao24: "a", kind: "helicopter", elevationDeg: 80 }),
      make({ icao24: "b", kind: "commercial", elevationDeg: 15 }),
    ]);
    expect(best?.icao24).toBe("b");
  });

  it("returns undefined when empty", () => {
    expect(selectBestVisibleFlight([])).toBeUndefined();
  });
});

describe("airport labels", () => {
  it("prefers the city and always includes the code", () => {
    expect(airportLabel("Los Angeles International Airport", "Los Angeles", "LAX")).toBe("Los Angeles (LAX)");
    expect(airportLabel("General Edward Lawrence Logan International Airport", "Boston", "BOS")).toBe("Boston (BOS)");
  });

  it("falls back to a tidied name, then to the code alone", () => {
    expect(airportLabel("Louis Armstrong New Orleans International Airport", "", "MSY")).toBe("Louis Armstrong New Orleans (MSY)");
    expect(compactAirportName("Intl Airport")).toBe("Intl Airport");
    expect(airportLabel("", "", "XYZ")).toBe("XYZ");
  });

  it("keeps a compact route short enough to fit the card", () => {
    const route = `${airportLabel("x", "Los Angeles", "LAX")} - ${airportLabel("x", "New Orleans", "MSY")}`;
    expect(route.length).toBeLessThanOrEqual(2 * 23);
  });
});

describe("parseAdsbDb", () => {
  const airport = (municipality: string, iata: string) => ({ name: "x", municipality, iata_code: iata });
  const body = (route: unknown) => ({
    response: {
      aircraft: { registration: "N12345", type: "Boeing 737-800", registered_owner: "United" },
      flightroute: route,
    },
  });

  it("reads the plane type, airline, flight number and route", () => {
    const route = {
      callsign_iata: "UA123",
      airline: { name: "United Airlines" },
      origin: airport("Chicago", "ORD"),
      destination: airport("Los Angeles", "LAX"),
    };
    expect(parseAdsbDb(body(route))).toEqual({
      registration: "N12345",
      registeredOwner: "United",
      aircraftType: "Boeing 737-800",
      airlineName: "United Airlines",
      flightNumber: "UA123",
      origin: "Chicago (ORD)",
      destination: "Los Angeles (LAX)",
    });
  });

  it("drops a half-known route but keeps the plane details", () => {
    const result = parseAdsbDb(body({ origin: airport("Chicago", "ORD") }));
    expect(result).toMatchObject({ aircraftType: "Boeing 737-800", origin: "", destination: "" });
  });

  it("returns null when there is nothing useful", () => {
    expect(parseAdsbDb(null)).toBeNull();
    expect(parseAdsbDb({ response: "unknown aircraft" })).toBeNull();
  });
});

describe("airline logos", () => {
  it("looks logos up by callsign prefix, case-insensitively", () => {
    expect(airlineCode(" ual123 ")).toBe("UAL");
    expect(findAirlineLogo("UAL123")?.icao).toBe("UAL");
    expect(findAirlineLogo("dal45")?.icao).toBe("DAL");
    expect(findAirlineLogo("ZZZ1")).toBeUndefined();
    expect(findAirlineLogo("")).toBeUndefined();
  });

  it("unpacks every bundled bitmap with some ink and some paper", () => {
    expect(AIRLINE_LOGO_ASSETS.length).toBeGreaterThan(0);
    for (const logo of AIRLINE_LOGO_ASSETS) {
      const pixels = logoPixels(logo);
      expect(pixels).toHaveLength(logo.width * logo.height);
      const ink = pixels.reduce((sum, p) => sum + p, 0);
      expect(ink, logo.icao).toBeGreaterThan(0);
      expect(ink, logo.icao).toBeLessThan(pixels.length);
    }
  });

  it("packs bits MSB-first with padded rows", () => {
    const logo = { icao: "TST", width: 3, height: 2, source: "", data: btoa("\xA0\x40") };
    expect([...logoPixels(logo)]).toEqual([1, 0, 1, 0, 1, 0]);
  });
});

describe("the visible-aircraft checkbox", () => {
  const steep = ["near", "UAL1", "", 0, 0, -117.95, 33.8557, 3000, false, 200, 90, 0, null, 3100, null, false, 0, 4];
  const shallow = ["mid", "DAL2", "", 0, 0, -117.7, 33.9557, 3000, false, 200, 90, 0, null, 3100, null, false, 0, 4];
  const distant = ["far", "AAL3", "", 0, 0, -116.5, 34.3557, 9000, false, 200, 90, 0, null, 9100, null, false, 0, 4];
  const low = ["low", "N911LA", "", 0, 0, -117.9143, 33.8366, 100, false, 40, 90, 0, null, 120, null, false, 0, 8];
  const response = { time: 0, states: [steep, shallow, distant, low] as never };
  const kept = (onlyVisible: boolean) =>
    parseStates(response, HOME, visibilityCriteria(onlyVisible)).map((f) => f.icao24);

  it("checked keeps only aircraft you could spot by eye", () => {
    expect(kept(true)).toEqual(["near"]);
  });

  it("unchecked lists everything airborne nearby, flat or low, but not far away", () => {
    expect(kept(false)).toEqual(["near", "mid", "low"]);
  });

  it("always fetches an area large enough for either setting", () => {
    expect(FETCH_RADIUS_KM).toBeGreaterThanOrEqual(visibilityCriteria(true).maxDistanceKm);
    expect(FETCH_RADIUS_KM).toBeGreaterThanOrEqual(visibilityCriteria(false).maxDistanceKm);
  });

  it("checked is the firmware's 45 km / 10 degree rule", () => {
    const criteria = visibilityCriteria(true);
    expect(criteria.maxDistanceKm).toBeCloseTo(45, 0);
    expect(criteria.minElevationDeg).toBe(10);
  });
});
