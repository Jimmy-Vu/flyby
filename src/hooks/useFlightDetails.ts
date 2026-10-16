import { useEffect, useState } from "react";
import { getFlightDetails } from "../lib/enrich";
import { applyDetails, type Flight, type FlightDetails } from "../lib/flight";

export function useFlightDetails(flight: Flight | undefined) {
  const key = flight ? `${flight.icao24}:${flight.callsign}` : "";
  const [result, setResult] = useState<{ key: string; details: FlightDetails } | null>(null);

  useEffect(() => {
    if (!flight) return;
    let ignore = false;
    getFlightDetails(flight).then((details) => {
      if (!ignore) setResult({ key, details });
    });
    return () => {
      ignore = true;
    };
  }, [key]);

  const details = result?.key === key ? result.details : undefined;
  return {
    flight: flight ? applyDetails(flight, details) : undefined,
    loading: Boolean(flight) && !details,
  };
}
