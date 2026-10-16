import { AIRLINE_LOGO_ASSETS, type AirlineLogoAsset } from "./airlineLogoData";

export function airlineCode(callsign: string): string {
  return callsign.trim().toUpperCase().slice(0, 3);
}

const byIcao = new Map<string, AirlineLogoAsset>(
  AIRLINE_LOGO_ASSETS.map((asset) => [asset.icao, asset]),
);

export function findAirlineLogo(callsign: string): AirlineLogoAsset | undefined {
  return byIcao.get(airlineCode(callsign));
}

export function logoPixels(logo: AirlineLogoAsset): Uint8Array {
  const bytes = Uint8Array.from(atob(logo.data), (c) => c.charCodeAt(0));
  const stride = Math.ceil(logo.width / 8);
  const pixels = new Uint8Array(logo.width * logo.height);
  for (let y = 0; y < logo.height; y++) {
    for (let x = 0; x < logo.width; x++) {
      const byte = bytes[y * stride + (x >> 3)];
      pixels[y * logo.width + x] = (byte >> (7 - (x & 7))) & 1;
    }
  }
  return pixels;
}
