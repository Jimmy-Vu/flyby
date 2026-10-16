import { useMemo, useState } from "react";
import { ScreenCard } from "./components/ScreenCard";
import { Button } from "./components/Button";
import { Passport } from "./components/Passport";
import { FlightList } from "./components/FlightList";
import { SettingsPanel, type Settings } from "./components/SettingsPanel";
import { useFlightDetails } from "./hooks/useFlightDetails";
import { useFlights } from "./hooks/useFlights";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { DEFAULT_LAT, DEFAULT_LON, DEFAULT_REFRESH_INTERVAL_S } from "./lib/config";
import { selectBestVisibleFlight } from "./lib/flight";

const DEFAULT_SETTINGS: Settings = {
  lat: DEFAULT_LAT,
  lon: DEFAULT_LON,
  onlyVisible: true,
  intervalS: DEFAULT_REFRESH_INTERVAL_S,
};

export default function App() {
  const [saved, setSettings] = useLocalStorage<Partial<Settings>>(
    "flyby:settings",
    DEFAULT_SETTINGS,
  );
  const settings: Settings = { ...DEFAULT_SETTINGS, ...saved };
  const { flights, status, error, refresh } = useFlights(
    settings.lat,
    settings.lon,
    settings.intervalS,
    settings.onlyVisible,
  );

  const [chosenId, setChosenId] = useState<string | null>(null);

  const selected = useMemo(() => {
    const chosen = chosenId ? flights.find((f) => f.icao24 === chosenId) : undefined;
    return chosen ?? selectBestVisibleFlight(flights);
  }, [flights, chosenId]);

  const index = selected ? flights.findIndex((f) => f.icao24 === selected.icao24) : -1;
  const { flight: detailed, loading } = useFlightDetails(selected);

  const browse = (delta: number) => {
    if (flights.length === 0) return;
    const next = (Math.max(index, 0) + delta + flights.length) % flights.length;
    setChosenId(flights[next].icao24);
  };

  return (
    <main className="mx-auto grid max-w-[1200px] gap-6 px-4 pt-6 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Flyby</h1>
        <div className="flex items-center gap-3 text-sm text-muted" role="status">
          {status === "loading" && "Scanning…"}
          {status === "error" && <span className="text-red-600">{error}</span>}
          <Button onClick={refresh}>Scan now</Button>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-8 min-[900px]:grid-cols-2">
        <Passport>
          {detailed ? (
            <ScreenCard
              flight={detailed}
              position={index + 1}
              total={flights.length}
              loading={loading}
            />
          ) : (
            <p className="py-8 text-center text-muted">
              {status === "loading"
                ? "Looking for nearby flights…"
                : settings.onlyVisible
                  ? "No aircraft you can see right now. Uncheck “Only show aircraft I can see” to list everything nearby."
                  : "No aircraft nearby right now. Scanning…"}
            </p>
          )}

          {flights.length > 0 && (
            <FlightList
              flights={flights}
              selectedId={selected?.icao24}
              onSelect={(icao24) => {
                setChosenId(icao24);
              }}
            />
          )}
        </Passport>

        <div className="grid gap-6 rounded-2xl border border-line bg-panel p-5 shadow-sm">
          <label className="flex cursor-pointer items-center gap-2 text-[0.95rem]">
            <input
              type="checkbox"
              className="size-[1.1rem] accent-accent"
              checked={settings.onlyVisible}
              onChange={(e) => setSettings({ ...settings, onlyVisible: e.target.checked })}
            />
            Only show aircraft I can see
          </label>

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => browse(-1)} disabled={!selected}>
              ◀ Prev
            </Button>
            <Button onClick={() => browse(1)} disabled={!selected}>
              Next ▶
            </Button>
          </div>

          <SettingsPanel settings={settings} onChange={setSettings} />
        </div>
      </div>
    </main>
  );
}
