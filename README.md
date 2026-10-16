# Flyby

Shows the aircraft near a location: flight number, airline, plane type, and
where it's flying from and to.

## How I used AI

I wrote the core code myself and used an AI coding assistant (Cursor) for the
rest, including the math, tests, styling and accessibility markup. I decided what
the app does and how it looks, and I reviewed everything the AI wrote or changed.
The math and its tests were both AI-generated, so they don't check each other
independently, and the accessibility markup hasn't been tested with a screen reader.

## Run

```sh
cp .env.example .env   # add your OpenSky keys
npm install
npm run dev
npm test
```

## How it works

- `useFlights.ts` polls OpenSky for aircraft around your coordinates.
- `opensky.ts` filters by distance and angle above the horizon and keeps the best
  5. The "Only show aircraft I can see" checkbox means within 28 mi and 10° up;
  unchecked is everything within 50 mi. The numbers are in `config.ts`.
- `routes.ts` looks up the plane type, airline and route on adsbdb.
- `flightScreen.ts` and `ScreenCard.tsx` draw the display and dither it.

## Notes

- The OpenSky keys are only used on the server (`server/proxy.ts`). Without them
  the app uses anonymous OpenSky, which has a small daily limit. `vite build` is
  static, so in production you'd run the proxy on a server.
- Routes come from callsigns, which get reused, so some will be wrong. Unknown
  flights show "Route unavailable".
- To rebuild the logo data: `node scripts/generate-airline-logos.mjs <path to airline_logo_bitmaps.cpp>`
