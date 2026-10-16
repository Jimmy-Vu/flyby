import { useEffect, useRef } from "react";
import { luminance, toInkRgba } from "../lib/dither";
import {
  SCREEN_H,
  SCREEN_W,
  SCREEN_SCALE,
  layoutFlightScreen,
  paintOps,
} from "../lib/flightScreen";
import type { Flight } from "../lib/flight";

interface Props {
  flight: Flight;
  position: number;
  total: number;
  loading: boolean;
}

export function ScreenCard({ flight, position, total, loading }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const width = SCREEN_W * SCREEN_SCALE;
  const height = SCREEN_H * SCREEN_SCALE;
  const ops = layoutFlightScreen(flight, { position, total, loading });

  const drawingKey = JSON.stringify(ops, (key, value) =>
    key === "logo" ? (value as { icao: string }).icao : value,
  );

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d", { willReadFrequently: true });
    if (!el || !ctx) return;

    paintOps(ctx, ops);
    const { data } = ctx.getImageData(0, 0, width, height);
    const ink = toInkRgba(luminance(data), width, height);

    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(new ImageData(ink, width, height), 0, 0);
  }, [drawingKey]);

  const description = ops.flatMap((op) => (op.kind === "text" ? [op.text] : [])).join(", ");

  return (
    <div className="w-full overflow-hidden rounded-lg border-[6px] border-[#222] bg-paper">
      <canvas
        className="block aspect-[250/128] h-auto w-full"
        ref={canvas}
        width={width}
        height={height}
        role="img"
        aria-label={`Flight display: ${description}`}
      />
    </div>
  );
}
