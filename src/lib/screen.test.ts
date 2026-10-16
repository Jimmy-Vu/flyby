import { describe, expect, it } from "vitest";
import { ditherFloydSteinberg, luminance, toInkRgba } from "./dither";
import { SCREEN_H, SCREEN_W, layoutFlightScreen, type DrawOp } from "./flightScreen";
import type { Flight } from "./flight";

const flat = (value: number, w = 16, h = 16) => new Float32Array(w * h).fill(value);
const inkCount = (bits: Uint8Array) => bits.reduce((sum, b) => sum + b, 0);

describe("dither (Floyd–Steinberg)", () => {
  it("maps pure white to paper and pure black to ink", () => {
    expect(inkCount(ditherFloydSteinberg(flat(255), 16, 16))).toBe(0);
    expect(inkCount(ditherFloydSteinberg(flat(0), 16, 16))).toBe(256);
  });

  it("approximates mid-gray with about half ink", () => {
    const ratio = inkCount(ditherFloydSteinberg(flat(128, 64, 64), 64, 64)) / (64 * 64);
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });

  it("ink density follows gray level", () => {
    const dark = inkCount(ditherFloydSteinberg(flat(64, 64, 64), 64, 64));
    const light = inkCount(ditherFloydSteinberg(flat(192, 64, 64), 64, 64));
    expect(dark).toBeGreaterThan(light * 2);
  });

  it("produces only 0/1 and preserves a hard black/white edge", () => {
    const gray = Float32Array.from({ length: 64 }, (_, i) => (i % 8 < 4 ? 0 : 255));
    const bits = ditherFloydSteinberg(gray, 8, 8);
    expect([...bits]).toEqual(Array.from({ length: 64 }, (_, i) => (i % 8 < 4 ? 1 : 0)));
  });

  it("composites transparency over white", () => {
    const gray = luminance(new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255]));
    expect([...gray]).toEqual([255, 0]);
  });

  it("emits black ink over a transparent background", () => {
    const rgba = toInkRgba(Float32Array.from([0, 255]), 2, 1);
    expect([...rgba.slice(0, 4)]).toEqual([17, 17, 17, 255]);
    expect(rgba[7]).toBe(0);
  });
});

describe("layoutFlightScreen", () => {
  const make = (partial: Partial<Flight>): Flight => ({
    icao24: "abc123",
    callsign: "UAL123",
    registration: "",
    registeredOwner: "",
    badgeLabel: "",
    airline: "United",
    flightNumber: "",
    origin: "",
    destination: "",
    aircraftType: "",
    kind: "commercial",
    emitterCategory: 4,
    lat: 0,
    lon: 0,
    altitudeM: 3048,
    velocityMs: 0,
    headingDeg: 0,
    bearingDeg: 0,
    distanceKm: 16.0934,
    elevationDeg: 20,
    ...partial,
  });
  const info = { position: 1, total: 1, loading: false };
  const texts = (ops: DrawOp[]) => ops.flatMap((op) => (op.kind === "text" ? [op] : []));

  it("shows airline, callsign, footer and the airline logo", () => {
    const ops = layoutFlightScreen(make({}), info);
    const t = texts(ops);
    expect(t[0]).toMatchObject({ text: "United", size: 12, y: 2 });
    expect(t[1]).toMatchObject({ text: "UAL123", size: 24, y: 17 });
    expect(t.at(-1)).toMatchObject({ text: "10000ft 10.0mi away", y: 108 });
    expect(ops.some((op) => op.kind === "bitmap")).toBe(true);
    expect(t.map((x) => x.text)).toContain("Route unavailable");
  });

  it("titles airliners with the flight number, falling back to the callsign", () => {
    const withNumber = texts(layoutFlightScreen(make({ flightNumber: "UA123" }), info));
    expect(withNumber.find((t) => t.size === 24)?.text).toBe("UA123");
    const without = texts(layoutFlightScreen(make({}), info));
    expect(without.find((t) => t.size === 24)?.text).toBe("UAL123");
  });

  it("falls back to a double-bordered text badge without a logo", () => {
    const ops = layoutFlightScreen(make({ callsign: "ZZZ99" }), info);
    expect(ops.filter((op) => op.kind === "rect")).toHaveLength(2);
    expect(texts(ops).some((t) => t.text === "ZZZ" && t.size === 24)).toBe(true);
  });

  it("uses HEL/MIL/PVT badges and the registration as title for non-airliners", () => {
    const ops = layoutFlightScreen(
      make({ kind: "helicopter", registration: "N911LA", badgeLabel: "" }),
      info,
    );
    expect(texts(ops).some((t) => t.text === "HEL")).toBe(true);
    expect(texts(ops).some((t) => t.text === "N911LA" && t.size === 24)).toBe(true);
    expect(texts(ops).some((t) => t.text.includes("Route"))).toBe(false);
  });

  it("prefixes the position, truncated to 23 characters", () => {
    const ops = layoutFlightScreen(
      make({ airline: "British Airways Shuttle Service" }),
      { position: 2, total: 5, loading: false },
    );
    const airline = texts(ops)[0].text;
    expect(airline.startsWith("2/5 British")).toBe(true);
    expect(airline.length).toBe(23);
  });

  it("shows origin and destination on separate lines", () => {
    const ops = layoutFlightScreen(
      make({ origin: "Guadalajara (GDL)", destination: "San Jose (SJC)" }),
      info,
    );
    const lines = texts(ops).map((t) => t.text);
    expect(lines).toContain("Guadalajara (GDL)");
    expect(lines).toContain("to San Jose (SJC)");
  });

  it("wraps long routes within the 140px details column", () => {
    const ops = layoutFlightScreen(
      make({
        origin: "Los Angeles International (LAX)",
        destination: "John F Kennedy International (JFK)",
      }),
      info,
    );
    const routeLines = texts(ops).filter((t) => t.y >= 44 && t.y < 108);
    expect(routeLines.length).toBeGreaterThan(1);
    for (const line of routeLines) {
      expect(line.text.length * 6).toBeLessThanOrEqual(140);
    }
  });

  it("keeps everything on the screen", () => {
    const ops = layoutFlightScreen(
      make({
        origin: "Los Angeles International (LAX)",
        destination: "John F Kennedy International (JFK)",
        aircraftType: "Boeing 737-800",
      }),
      info,
    );
    for (const op of texts(ops)) {
      expect(op.y + op.size).toBeLessThanOrEqual(SCREEN_H);
      expect(op.x + op.text.length * (op.size / 2)).toBeLessThanOrEqual(SCREEN_W);
    }
  });
});
