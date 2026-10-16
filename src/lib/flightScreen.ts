import type { AirlineLogoAsset } from "./airlineLogoData";
import { airlineCode, findAirlineLogo, logoPixels } from "./airlineLogos";
import { KM_TO_MI, M_TO_FT } from "./config";
import type { Flight } from "./flight";

export const SCREEN_W = 250;
export const SCREEN_H = 128;

export const SCREEN_SCALE = 4;

const DETAILS_X = 3;
const DETAILS_WIDTH = 140;
const LOGO_X = 150;
const LOGO_WIDTH = SCREEN_W - LOGO_X;
const FOOTER_Y = 108;

export type DrawOp =
  | { kind: "text"; x: number; y: number; text: string; size: number }
  | { kind: "rect"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "bitmap"; logo: AirlineLogoAsset; x: number; y: number };

export interface ScreenInfo {
  position: number;
  total: number;
  loading: boolean;
}

export const charWidth = (size: number) => size / 2;

function wrap(
  ops: DrawOp[],
  x: number,
  y: number,
  text: string,
  size: number,
  maxWidth: number,
  bottomLimit = SCREEN_H,
): number {
  const charsPerLine = Math.max(1, Math.floor(maxWidth / charWidth(size)));
  let remaining = text;
  let cursorY = y;

  for (;;) {
    remaining = remaining.trim();
    if (remaining.length === 0 || cursorY + size > bottomLimit) break;

    let lineLength = remaining.length;
    if (lineLength > charsPerLine) {
      const space = remaining.lastIndexOf(" ", charsPerLine);
      lineLength = space > 0 ? space : charsPerLine;
    }
    ops.push({ kind: "text", x, y: cursorY, text: remaining.slice(0, lineLength), size });
    remaining = remaining.slice(lineLength);
    cursorY += size + 2;
  }
  return cursorY;
}

function centeredText(
  ops: DrawOp[],
  x: number,
  y: number,
  width: number,
  text: string,
  size: number,
) {
  const textWidth = text.length * charWidth(size);
  const textX = textWidth < width ? x + Math.floor((width - textWidth) / 2) : x;
  ops.push({ kind: "text", x: textX, y, text, size });
}

function badge(ops: DrawOp[], label: string, x: number, y: number, width: number, height: number) {
  const left = x + 8;
  const right = x + width - 9;
  const top = y + 12;
  const bottom = y + height - 13;
  ops.push({ kind: "rect", x1: left, y1: top, x2: right, y2: bottom });
  ops.push({ kind: "rect", x1: left + 3, y1: top + 3, x2: right - 3, y2: bottom - 3 });
  centeredText(ops, x, y + Math.floor((height - 24) / 2), width, label || "---", 24);
}

export function layoutFlightScreen(flight: Flight, info: ScreenInfo): DrawOp[] {
  const ops: DrawOp[] = [];
  const commercial = flight.kind === "commercial";

  const logo = commercial ? findAirlineLogo(flight.callsign) : undefined;
  if (logo) {
    ops.push({
      kind: "bitmap",
      logo,
      x: LOGO_X + Math.floor((LOGO_WIDTH - Math.min(logo.width, LOGO_WIDTH)) / 2),
      y: Math.floor((SCREEN_H - Math.min(logo.height, SCREEN_H)) / 2),
    });
  } else {
    const label = commercial
      ? airlineCode(flight.callsign)
      : flight.badgeLabel ||
        (flight.kind === "helicopter" ? "HEL" : flight.kind === "military" ? "MIL" : "PVT");
    badge(ops, label, LOGO_X, 0, LOGO_WIDTH, SCREEN_H);
  }

  let airline = flight.airline;
  if (info.position > 0 && info.total > 1) airline = `${info.position}/${info.total} ${airline}`;
  ops.push({ kind: "text", x: DETAILS_X, y: 2, text: airline.slice(0, 23), size: 12 });

  const title =
    (commercial
      ? flight.flightNumber || flight.callsign
      : flight.registration || flight.callsign) || flight.icao24;
  ops.push({ kind: "text", x: DETAILS_X, y: 17, text: title, size: 24 });

  let y = 44;
  if (commercial) {
    if (flight.origin && flight.destination) {
      y = wrap(ops, DETAILS_X, y, flight.origin, 12, DETAILS_WIDTH, FOOTER_Y - 2);
      y = wrap(ops, DETAILS_X, y, `to ${flight.destination}`, 12, DETAILS_WIDTH, FOOTER_Y - 2);
    } else {
      wrap(
        ops,
        DETAILS_X,
        y,
        info.loading ? "Looking up route..." : "Route unavailable",
        12,
        DETAILS_WIDTH,
        FOOTER_Y - 2,
      );
      y += 14;
    }
  }

  if (flight.aircraftType && y + 12 <= FOOTER_Y - 2) {
    y = wrap(ops, DETAILS_X, y, `Type: ${flight.aircraftType}`, 12, DETAILS_WIDTH, FOOTER_Y - 2);
  }

  const altitudeFt = Math.trunc(flight.altitudeM * M_TO_FT);
  const distanceMi = (flight.distanceKm * KM_TO_MI).toFixed(1);
  ops.push({
    kind: "text",
    x: DETAILS_X,
    y: FOOTER_Y,
    text: `${altitudeFt}ft ${distanceMi}mi away`,
    size: 12,
  });

  return ops;
}

const FONT_FAMILY = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export function paintOps(ctx: CanvasRenderingContext2D, ops: DrawOp[], scale = SCREEN_SCALE) {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "top";
  ctx.textAlign = "center";

  for (const op of ops) {
    switch (op.kind) {
      case "text": {
        const pitch = charWidth(op.size);
        ctx.font = `600 ${Math.round(pitch / 0.6)}px ${FONT_FAMILY}`;
        [...op.text].forEach((char, i) => {
          ctx.fillText(char, op.x + pitch * i + pitch / 2, op.y);
        });
        break;
      }
      case "rect": {
        ctx.fillRect(op.x1, op.y1, op.x2 - op.x1 + 1, 1);
        ctx.fillRect(op.x1, op.y2, op.x2 - op.x1 + 1, 1);
        ctx.fillRect(op.x1, op.y1, 1, op.y2 - op.y1 + 1);
        ctx.fillRect(op.x2, op.y1, 1, op.y2 - op.y1 + 1);
        break;
      }
      case "bitmap": {
        const pixels = logoPixels(op.logo);
        for (let row = 0; row < op.logo.height; row++) {
          for (let col = 0; col < op.logo.width; col++) {
            if (pixels[row * op.logo.width + col]) ctx.fillRect(op.x + col, op.y + row, 1, 1);
          }
        }
        break;
      }
    }
  }
  ctx.restore();
}
