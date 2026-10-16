import { useEffect, useMemo, useState } from "react";
import { MAX_FLIGHTS } from "../lib/config";
import { compareFlights, type Flight } from "../lib/flight";
import { fetchStates, parseStates, type StatesResponse } from "../lib/opensky";
import { FETCH_RADIUS_KM, visibilityCriteria } from "../lib/visibility";

export type FetchStatus = "loading" | "ok" | "error";

export function useFlights(lat: number, lon: number, intervalS: number, onlyVisible: boolean) {
  const [raw, setRaw] = useState<StatesResponse | null>(null);
  const [status, setStatus] = useState<FetchStatus>("loading");
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setRaw(await fetchStates({ lat, lon }, FETCH_RADIUS_KM));
      setStatus("ok");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to fetch flights");
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, intervalS * 1000);
    return () => clearInterval(timer);
  }, [lat, lon, intervalS]);

  const flights: Flight[] = useMemo(() => {
    if (!raw) return [];
    return parseStates(raw, { lat, lon }, visibilityCriteria(onlyVisible))
      .sort(compareFlights)
      .slice(0, MAX_FLIGHTS);
  }, [raw, lat, lon, onlyVisible]);

  return { flights, status, error, refresh };
}
