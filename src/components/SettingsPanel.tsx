import { useState } from "react";
import { MIN_REFRESH_INTERVAL_S } from "../lib/config";
import { Button } from "./Button";

export interface Settings {
  lat: number;
  lon: number;
  onlyVisible: boolean;
  intervalS: number;
}

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

function NumberField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  hint?: string;
  onCommit: (value: number) => void;
}) {
  const { label, value, min, max, step, hint, onCommit } = props;
  const [draft, setDraft] = useState<string | null>(null);

  const text = draft === null ? String(value) : draft;
  const number = draft === null ? value : Number(draft);
  const valid = text !== "" && number >= min && number <= max;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDraft(e.target.value);
    const next = e.target.valueAsNumber;
    if (next >= min && next <= max) onCommit(next);
  }

  return (
    <label className="grid gap-1 text-xs text-muted">
      {label}
      <input
        type="number"
        className="rounded-md border border-line bg-transparent px-2 py-1.5 text-fg aria-invalid:border-red-600"
        value={text}
        min={min}
        max={max}
        step={step}
        aria-invalid={!valid}
        onChange={handleChange}
        onBlur={() => setDraft(null)}
      />
      <span className={`text-[0.72rem] leading-snug ${valid ? "" : "text-red-600"}`}>
        {valid ? hint : `Enter a value from ${min} to ${max}.`}
      </span>
    </label>
  );
}

const h2 = "mt-5 mb-3 text-base font-semibold first:mt-0";

export function SettingsPanel({ settings, onChange }: Props) {
  const [geoError, setGeoError] = useState<string | null>(null);

  const useMyLocation = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        onChange({
          ...settings,
          lat: Number(pos.coords.latitude.toFixed(6)),
          lon: Number(pos.coords.longitude.toFixed(6)),
        }),
      (err) => setGeoError(err.message),
    );
  };

  return (
    <section>
      <h2 className={h2}>Your location</h2>
      <div className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <NumberField
          label="Latitude"
          value={settings.lat}
          min={-90}
          max={90}
          step={0.0001}
          onCommit={(lat) => onChange({ ...settings, lat })}
        />
        <NumberField
          label="Longitude"
          value={settings.lon}
          min={-180}
          max={180}
          step={0.0001}
          onCommit={(lon) => onChange({ ...settings, lon })}
        />
      </div>
      <Button onClick={useMyLocation}>Use my location</Button>
      {geoError && <p className="text-red-600">{geoError}</p>}

      <h2 className={h2}>Polling</h2>
      <div className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <NumberField
          label="Refresh (seconds)"
          value={settings.intervalS}
          min={MIN_REFRESH_INTERVAL_S}
          max={3600}
          step={5}
          hint="How often to look for aircraft."
          onCommit={(intervalS) => onChange({ ...settings, intervalS })}
        />
      </div>
    </section>
  );
}
