import { KM_TO_MI, M_TO_FT } from "../lib/config";
import type { Flight } from "../lib/flight";

interface Props {
  flights: Flight[];
  selectedId?: string;
  onSelect: (icao24: string) => void;
}

const KIND_LABEL: Record<Flight["kind"], string> = {
  commercial: "Airline",
  helicopter: "Helicopter",
  military: "Military",
  private: "Private",
};

const HEADERS = ["Flight", "Type", "Altitude", "Distance", "Look", "Elev.", "Heading"];
const cell = "border-b border-line px-1.5 py-2 whitespace-nowrap";

function degrees(deg: number): number {
  return Math.round(deg) % 360;
}

function compass(deg: number): string {
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return points[Math.round(deg / 45) % 8];
}

export function FlightList({ flights, selectedId, onSelect }: Props) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          {HEADERS.map((header) => (
            <th key={header} className={`${cell} text-left text-xs font-medium text-muted`}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {flights.map((flight) => (
          <tr
            key={flight.icao24}
            className={`cursor-pointer hover:bg-accent/10 ${
              flight.icao24 === selectedId ? "bg-accent/10" : ""
            }`}
            onClick={() => onSelect(flight.icao24)}
          >
            <td className={cell}>
              <strong>{flight.flightNumber || flight.callsign || flight.icao24}</strong>
              <div className="text-xs text-muted">
                {flight.airline}
                {flight.flightNumber && flight.callsign ? ` · ${flight.callsign}` : ""}
              </div>
            </td>
            <td className={cell}>{KIND_LABEL[flight.kind]}</td>
            <td className={cell}>{Math.round(flight.altitudeM * M_TO_FT).toLocaleString()} ft</td>
            <td className={cell}>{(flight.distanceKm * KM_TO_MI).toFixed(1)} mi</td>
            <td className={cell}>
              {compass(flight.bearingDeg)} {degrees(flight.bearingDeg)}°
            </td>
            <td className={cell}>{Math.round(flight.elevationDeg)}°</td>
            <td className={cell}>
              {compass(flight.headingDeg)} {degrees(flight.headingDeg)}°
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
