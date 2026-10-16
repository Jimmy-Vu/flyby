import type { ReactNode } from "react";

const LINE_1 = "P<AIR<<FLYBY".padEnd(44, "<");
const LINE_2 = "SPOTTER<<0000000000".padEnd(44, "<");

export function Passport({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-[#c9a54b] bg-[#1f2d4d] p-4 shadow-md">
      <div className="mb-3 flex items-center justify-between px-1 text-[#e0c36f]">
        <span className="text-xs font-semibold tracking-[0.35em]">PASSPORT</span>
        <span className="text-lg" aria-hidden="true">
          ✈
        </span>
        <span className="text-xs font-semibold tracking-[0.35em]">FLYBY</span>
      </div>

      <div className="grid gap-5 rounded-lg border border-[#c9b98f] bg-[#f3ead2] bg-[repeating-radial-gradient(circle_at_15%_0%,transparent_0_7px,rgba(31,45,77,0.06)_7px_8px)] p-4">
        {children}

        <div
          className="overflow-hidden rounded-sm bg-white/50 px-2 py-1.5 font-mono text-[0.6rem] leading-4 tracking-[0.12em] whitespace-nowrap text-fg"
          aria-hidden="true"
        >
          <div>{LINE_1}</div>
          <div>{LINE_2}</div>
        </div>
      </div>
    </div>
  );
}
